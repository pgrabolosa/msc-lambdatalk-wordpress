/*	LAMBDATALK | copyleft_GPL alainmarty 2020 */

//// LAMBDATALK & LAMBDATANK version 2020/04/17

//// Started modifying 2020/11/24 - Pierre Grabolosa
////    * Removed LambdaTank
////    * Removed lots of JS bridging (Arrays, Strings, etc)
////    * Modified IF syntax from {if A then B else C} to {if A B [C]}
////    * Started replacing var with let + fixed a few unintended globals 
////    * Added a crude tree traversal/text replacement => lost ability to produce HTML => TODO?
//// 
//// 2021/02/28 - Pierre Grabolosa
////    * Added auto-run on DOMContentLoaded for .lambdatalk-out pre

"use strict";

let LAMBDATALK = (function() {
  const re_application = /\{\s*([^\s{}]*)(?:[\s]*)([^{}]*)\s*\}/g;
  let DICT = {}, LAMB_nextId = 0;  // primitives, lambdas & defs
  let LAZY = {}, LAZY_nextId = 0;  // lazily evaluated primitives/lambdas
  let QUOT = {}, QUOT_nextId = 0;  // quotes
  let MACR = {}, MACR_nextId = 0;  // macros
  
  // 1) MAIN FUNCTION

  /** This function evaluates a string of LambdaTalk and returns the evaluation result or null if there is an error. */
  let evaluate = function(s) {
    let bal = balance(s);
    if (bal.left === bal.right) {
      s = preprocessing(s);
      s = eval_macros(s);
      s = eval_specials(s,'quote',eval_quote);
      s = eval_specials(s,'let',eval_let);
      s = eval_specials(s,'lambda',eval_lambda);
      s = eval_specials(s,'def',eval_def,true);

      s = eval_forms(s);
      s = postprocessing(s);

      return s;
    }
    throw "ERROR: improper balancing - " + JSON.stringify(bal);
  };
  
  // 2) EVAL SEQUENCES OF NESTED FORMS FROM INSIDE OUT
  
  /** Calls `eval_form` until there is no more need for it. */
  let eval_forms = function(s) { // nested (first rest)
    while (s !== (s = s.replace(re_application, eval_form)));
    return s;
  };
  let eval_lazyForms = function(s) { // nested (first rest)
    while (s !== (s = s.replace(re_application, eval_lazy)));
    return s;
  };

  /** Evaluates forms from the dictionnary. */
  let eval_form = function() {
    let f = arguments[1] || "", r = arguments[2] || "";
    if (DICT.hasOwnProperty(f)) return DICT[f].apply(null, [r]);
    else if (LAZY.hasOwnProperty(f)) return LAZY[f].apply(null, [r]);
    else throw "ERROR: undefined " + f + " application";
  };
  
  // 3) CATCH & EVAL SPECIAL FORMS
  
  let eval_specials = function(s,symbol,eval_symbol,flag) {
    while (s !== (s = form_replace(s, symbol, eval_symbol, flag))) ;
    return s; 
  };
  
  /** Tries to replace **ALL** macros… */
  let eval_macros = function(s) {
    s = eval_specials(s,'macro',eval_macro);
    for (let macro in MACR) s = s.replace( macro.one, macro.two);
    return s
  };
  
  //// LAMBDA : {lambda {args} expression}
  let eval_lambda = function(s) { 
    s = eval_specials(s,'lambda',eval_lambda);
    let index = s.indexOf("}"),
    argStr = supertrim(s.substring(1, index)),
    args = argStr === "" ? [] : argStr.split(" "),
    body = supertrim(s.substring(index + 2)),
    name = "_LAMB_" + LAMB_nextId++;
    DICT[name] = function() {
      let valStr = supertrim(arguments[0]),
      vals = valStr === "" ? [] : valStr.split(" "),
      bod = body;
      if (vals.length < args.length) {          // 1) partial call
        for (let i = 0; i < vals.length; i++)
        bod = bod.replace(RegExp(args[i], "g"), vals[i]);
        let _args_ = args.slice(vals.length).join(" ");
        bod = eval_lambda("{" + _args_ + "} " + bod);
      } else if (vals.length === args.length) { // 2) total call
        for (let i=0; i < args.length; i++)
        bod = bod.replace( RegExp(args[i], "g"), vals[i] );
      } else { // 3) extra are gathered in the last one
        let _vals_ = vals.slice(0,args.length);
        _vals_[args.length-1] = vals.slice(args.length-1,vals.length).join(' ');
        for (let i=0; i < args.length; i++)
        bod = bod.replace( RegExp(args[i], "g"), _vals_[i] ); 
      }
      bod = eval_specials(bod,'if',eval_if);
      return eval_forms(bod);
    };
    return name;
  };
  
  //// DEF : {def name expression}
  let eval_def = function(s, flag) { 
    s = eval_specials(s,'def',eval_def,false);
    let index = s.search(/\s/);
    let name = s.substring(0, index).trim();
    let body = s.substring(index).trim();
    if (body.substring(0, 6) === "_LAMB_") {
      DICT[name] = DICT[body];
    } else {
      body = eval_forms(body);
      DICT[name] = function() {
        return body;
      };
    }
    return flag ? name : "";
  };
  
  //// IF : {if bool then one else two}
  let eval_if = function(s) {
    s = eval_specials(s,'if',eval_if);
    
    // extract parameters without evaluating
    let balance = 0;
    let argIndex = 0;
    let args = [''];

    for(let c of Array.from(s.trim())) {
      switch (c) {
        case '{': 
          balance += 1; break;
        case '}': 
          balance -= 1; break;
        case ' ': case '\n': case '\t':
          if (balance == 0 && args[argIndex].length > 0) {
            argIndex += 1;
            args[argIndex] = '';
          }
          break;
      }
      args[argIndex] += c;
    }

    // if expects two or three params
    if (args.length < 2 || 3 < args.length) {
      throw "ERROR: invalid IF syntax -- must provide two or three params {if bool exprTrue [exprFalse}"
    }
    if (args.length == 2) args.push('');
    
    return (eval_forms(args[0]) === 'true')? args[1] : args[2];
  };
  LAZY["if"] = eval_if;
  
  //// LET : (let ( (arg val) ...) body) -> ((lambda (args) body) vals) 
  var eval_let = function(s) {
    s = eval_specials(s,'let',eval_let);
    s = supertrim(s);
    var varvals = catch_form("{", s);
    var body = supertrim(s.replace(varvals, ""));
    varvals = varvals.substring(1, varvals.length - 1);
    var avv = [], i = 0;
    while (true) {
      avv[i] = catch_form("{", varvals);
      if (avv[i] === "none") break;
      varvals = varvals.replace(avv[i], "");
      i++;
    }
    for (var one = "", two = "", i = 0; i < avv.length - 1; i++) {
      var index = avv[i].indexOf(" ");
      one += avv[i].substring(1, index) + " ";
      two += avv[i].substring(index + 1, avv[i].length - 1) + " ";
    }
    return "{{lambda {" + one + "} " + body + "} " + two + "}";
  };
  
  //// QUOTE : {quote ...} or '{...} -> _QUOT_xxx
  var eval_quote = function(s) { // (quote expressions)
    return quote(s);
  };
  //// MACRO : {macro reg-exp to LAMBDATALK-exp}
  var eval_macro = function(s) {
    var index = s.indexOf('to'),
    one = supertrim(s.substring(0, index)),
    two = supertrim(s.substring(index+2));
    one = RegExp( one, 'g' );
    two = two.replace( /€/g, '$' ); // because of PHP conflicts with $
    var name = '_MACR_' + MACR_nextId++;
    MACR[name] = {one:one, two:two };
    return '';
  };
  
  //// 4) PREPROCESSING / POSTPROCESSING
  var preprocessing = function(s) {
    LAMB_nextId = 0;
    QUOT_nextId = 0;
    MACR_nextId = 0;
    
    s = comments( s );
    s = block2quote( s );
    s = apo2quote( s );
    return s;
  };
  
  var postprocessing = function(s) {
    s = s.replace(/(_QUOT_\d+)/g, unquote);
    s = syntax_highlight( s );
    
    LAMB_nextId = 0;
    QUOT_nextId = 0;
    MACR_nextId = 0;
    return s;
  };
  
  //// 5) HELPER FUNCTIONS 
  
  //// while (s !== (s = form_replace(s, "sym",  eval_sym))) ;
  var form_replace = function(str, symbol, func, flag) {
    symbol = "{" + symbol + " ";
    var s = catch_form(symbol, str);
    return s === "none" ? str : str.replace(symbol + s + "}", func(s, flag));
  };
  var catch_form = function(symbol, str) {
    var start = str.indexOf(symbol);
    if (start == -1) return "none";
    var d1, d2;
    if (symbol === "{") { // {:x v} in let
    d1 = 0; d2 = 1;
  } else {              // {symbol ...}
  d1 = symbol.length; d2 = 0;
}
var nb = 1, index = start;
while (nb > 0) {
  index++;
  if (str.charAt(index) == "{") nb++;
  else if (str.charAt(index) == "}") nb--;
}
return str.substring(start + d1, index + d2);
};
var balance = function(s) {
  var strt = s.match(/\{/g),
    stop = s.match(/\}/g);
    strt = strt ? strt.length : 0;
    stop = stop ? stop.length : 0;
    return { left: strt, right: stop };
  };
  var supertrim = function(s) {
    return s.trim().replace(/\s+/g, " ");
  };
  var quote = function(s) { // (quote x) -> _QUOT_n
    var name = "_QUOT_" + QUOT_nextId++;
    QUOT[name] = s;
    return name;
  };
  var unquote = function(s) { // _QUOT_n -> x
    var ss = QUOT[s]; //
    if (ss === '') return; 
    return ss.charAt(0) !== "_"
    ? ss                                // from (quote x)
    : "{" + ss.substring(1) + "}";      // from '(x)
  };
  var block2quote = function ( str ) {      // °° some text °° -> _QUOT_xxx
    var tab = str.match( /°°[\s\S]*?°°/g );
    if (tab == null) return str;
    for (var i=0; i< tab.length; i++) {
      var temp = tab[i];
      temp = temp.replace( /°°/g, '' );
      temp = quote(temp);
      str = str.replace( tab[i], temp );
    }
    return str;
  };
  var apo2quote = function (s) {  // '{x} -> {quote _x}
  return s.replace(/'\{/g, "{quote _");   //'
};

// start edit 2020/01/29
var comments = function (s) {
  s = s.trim()
  .replace( /°°°[\s\S]*?°°°/g, '' )  // delete multiline comments
  .replace( /;;[^\n]*/g, '' );    // delete one line comments
  //  .replace( /;; [^\s]*/g, '' );    // delete one line comments
  return s;
};
// end edit 2020/01/29

var decodeHtmlEntity = function(str) {
  // https://gist.github.com/CatTail/4174511
  return str.replace(/&#(\d+);/g, function(match, dec) {
    return String.fromCharCode(dec);
  });
};
var syntax_highlight = function( str ) { // highlight {} and special forms 
str = str.replace( 
  /\{(lambda |def |if |let |quote |macro |script |style |macro |require)/g,
    '<span style="color:#f00;">{$1</span>' )
    .replace( /(\{|\})/g, '<span style="color:#888">$1</span>' );
    return str;
  };
  
  //// END OF THE LAMBDATALK'S KERNEL
  
  
  //// 6) DICTIONARY populated with only two function, include and lib
  
  var PAGE = "";
  
  var include = function(page) { 
    if (PAGE === page) return '';
    
    var x = new XMLHttpRequest();
    x.open('GET', 'pages/' + page + '.txt', true);  // true -> async
    x.onreadystatechange = function () { 
      if (x.readyState == 4) {
        if (x.status === 200) {
          PAGE = page;
          var r = decodeHtmlEntity( x.responseText );
          document.getElementById("page_content").innerHTML += evaluate(r).val;
        }
      }
    };    
    x.send(null);   
    
    return ""
  };
  
  DICT["include"] = function() {   // {include page}
  return include( arguments[0].trim() )  
};

DICT["lib"] = function() {
  var str = "",
  index = 0;
  for (var key in DICT) {
    if (DICT.hasOwnProperty(key) 
    && key.substring(0, 6) !== "_LAMB_") {
      str += key + ", ";
      index++;
    }
  }
  return "DICT: [" + index + "] [" + str.substring(0, str.length - 2) + "]";
};

//  The rest of dictionary is populated outside LAMBDATALK, extendable on demand

return {
  evaluate: evaluate,
  eval_forms:eval_forms,
  balance:balance,
  form_replace:form_replace,
  catch_form:catch_form,
  supertrim: supertrim,
  quote:quote,
  unquote:unquote,
  LAZY:LAZY,
  DICT:DICT            // DICT is public -> caution!
};

})(); // end of LAMBDATALK


//// Populating LAMBDATALK.DICT 

//// MATH
var MATH = (function() {
  
  LAMBDATALK.DICT["+"] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" "), r;
    if (a.length === 0)      r = 0;
    else if (a.length === 1) r = a[0];
    else if (a.length === 2) r = Number(a[0]) + Number(a[1]);
    else for (var r = 0, i = 0; i < a.length; i++) r += Number(a[i]);
    return r;
  };
  LAMBDATALK.DICT["*"] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" "), r;
    if (a.length === 0)      r = 1;
    else if (a.length === 1) r = a[0];
    else if (a.length === 2) r = a[0] * a[1];
    else for (var r = 1, i = 0; i < a.length; i++) r *= a[i];
    return r;
  };
  LAMBDATALK.DICT["-"] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" ");
    var r = a[0];
    if (a.length === 1) r = -r;
    else  for (var i = 1; i < a.length; i++) r -= a[i];
    return r;
  };
  LAMBDATALK.DICT["/"] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" ");
    var r = a[0];
    if (a.length === 1) r = 1 / r;
    else for (var i = 1; i < a.length; i++) r /= a[i];
    return r;
  };
  LAMBDATALK.DICT["%"] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" ");
    return Number(a[0]) % Number(a[1]);
  };
  
  LAMBDATALK.DICT["<"] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" ");
    var x = Number(a[0]), y = Number(a[1]);
    return (x < y) ? "true" : "false";
  };
  LAMBDATALK.DICT[">"] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" ");
    var x = Number(a[0]), y = Number(a[1]);
    return (x > y) ? "true" : "false";
  };
  LAMBDATALK.DICT["<="] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" ");
    var x = Number(a[0]), y = Number(a[1]);
    return (x <= y) ? "true" : "false";
  };
  LAMBDATALK.DICT[">="] = function() {
    var a = LAMBDATALK.supertrim(arguments[0]).split(" ");
    var x = Number(a[0]), y = Number(a[1]);
    return (x >= y) ? "true" : "false";
  };
  LAMBDATALK.DICT['='] = function() {      // {= one two}
  var a = LAMBDATALK.supertrim(arguments[0]).split(' '),
  x = Number(a[0]), y = Number(a[1]); 
  return (!(x < y) && !(y < x))? 'true' : 'false';  
};

LAMBDATALK.DICT['not'] = function () { 
  var a = LAMBDATALK.supertrim(arguments[0]); 
  return (a === 'true')? 'false' : 'true';
};
LAMBDATALK.DICT['or'] = function () {
  var terms = LAMBDATALK.supertrim(arguments[0]).split(' '); 
  for (var ret=false, i=0; i< terms.length; i++)
  if (terms[i] === 'true') return 'true';
  return ret;
};
LAMBDATALK.DICT['and'] = function () { // (and (= 1 1) (= 1 2)) -> false 
  var terms = LAMBDATALK.supertrim(arguments[0]).split(' '); 
  for (var ret=true, i=0; i< terms.length; i++)
  if (terms[i] === 'false') return 'false';
  return ret;
};

var mathtags = [ "abs", "acos", "asin", "atan", "ceil", "cos", "exp", "floor", "pow", "log", "random", "round", "sin", "sqrt", "tan", "min", "max" ];
/*
var mathtags = [ "abs", "acos", "asin", "atan", "ceil", "cos", "exp", "floor", "pow", "log", "random", "round", "sin", "sqrt", "tan", "min", "max" ];
for (var i = 0; i < mathtags.length; i++) {
  LAMBDATALK.DICT[mathtags[i]] = (function(tag) {
    return function() {
      return tag.apply(null, LAMBDATALK.supertrim(arguments[0]).split(" "));
    };
  })(Math[mathtags[i]]);
}
*/

for (var i = 0; i < mathtags.length; i++) {
  LAMBDATALK.DICT[mathtags[i]] = (function(tag) {
    return function() {
      var args = LAMBDATALK.supertrim(arguments[0]).split(" ");
      // var args = arguments[0].split(" ");
      return Math[tag].apply(null,args);
    };
  })(mathtags[i])
}


LAMBDATALK.DICT["PI"] = function() { return Math.PI };
LAMBDATALK.DICT["E"] = function() { return Math.E };
LAMBDATALK.DICT['date'] = function () { 
  var now = new Date();
  var year    = now.getFullYear(), 
  month   = now.getMonth() + 1, 
  day     = now.getDate(),
  hours   = now.getHours(), 
  minutes = now.getMinutes(), 
  seconds = now.getSeconds();
  if (month<10) month = '0' + month;
  if (day<10) day = '0' + day;
  if (hours<10) hours = '0' + hours;
  if (minutes<10) minutes = '0' + minutes;
  if (seconds<10) seconds = '0' + seconds;
  return year+' '+month+' '+day+' '+hours+' '+minutes+' '+seconds;
};  

})();  
// end MATH


var display_update = function() {
  var t0 = new Date().getTime(),
  code = document.getElementById('page_textarea').value,
  result = LAMBDATALK.evaluate( code ),  // {val,bal}
  time = new Date().getTime() - t0;
  document.getElementById('page_infos').innerHTML = 
  '{' + result.bal.left + ':' + result.bal.right  + '} ' + time + 'ms';           
  if (result.bal.left === result.bal.right)
  document.getElementById('page_content').innerHTML = result.val ;
};


//// HTML & CSS
LAMBDATALK.DICT["b"] = function() {
  let e = document.createElement("span");
  e.setAttribute('style', "font-weight: bold");
  e.textContent = arguments[0];
  return e.outerHTML;
};

LAMBDATALK.DICT["js"] = function() {
  eval(arguments[0])
  return '';
};

//========================================================================

// on load process all lambdatalk-out
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.lambdatalk-out pre').forEach(function($element){
    let rawText = $element.textContent;
    $element.parentElement.innerHTML = LAMBDATALK.evaluate(rawText);
  });
});
