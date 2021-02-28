# LT4WP: LambdaTalk for WordPress

  - by Pierre Grabolosa, 2021
  - based on original work by Alain Marty


## TL;DR

Having downloaded this repository, run 

```
docker-compose up -d
```

Then visit `http://localhost:5000/`, configure WordPress as required (host is `sql`, database is named `wordpress`, user is `root`, password is `secret123456`), then create a new article with the following content:

```
[lambda]Hello, world! I am {- 2021 1983} years old. {b Crazy} right?[\lambda]
```

When viewing the post, you should instead see: 

> Hello, world! I am 38 years old. **Crazy** right?


## Disclaimer & License

**This project was developed as an assignment within the Université Côte d'Azur MSc Smart EdTech; although it had been on my *TODO* list for quite some time.**


### Bad Code License


```
This source code is distributed under the terms of the Bad Code License.

You are forbidden from distributing software containing this code "as is"
to end users because it serves a narrow and limited educational purpose.
This code is therefore incomplete and bad.

This software is provided ``as is'' and without any express or implied
warranties, including, without limitation, the implied warranties of
merchantability and fitness for a particular purpose.

No attribution is required, but it is appreciated.

Have fun experimenting!
```


## About this project

LambdaTalk is a wiki formatting and programming language by Alain Marty. Its appeal comes from proposing a unified syntax for content, formatting, and programming.

This very interesting and appealing language is however part of a larger Wiki effort called *LambdaTank*. Despite having many merits, LambdaTank is no substitute for WordPress, Dokuwiki, or Wikimedia. This project aims at *liberating* LambdaTalk and enabling its use within WordPress. A later effort many port it to Dokuwiki and Wikimedia.


### More about LambdaTalk

Mr Marty's vision is conceptually inspired by the origins of JavaScript (which is LISP-based) and by the beauty of Alonzo Church's lambda calculus. Mr Marty has also a deep attachment to Wiki foundational principles by Ward Cunningham.

LambdaTalk is interpreted by the client's Web browser, by applying a regular expression substitution repeatedly. The implementation is very simple and yet fast. Here's what Ward Cunningham wrote in 2014 in a email to Mr. Marty:

> I am impressed with this work and understand its uniqueness better now. [...]
> The fact that it is repeated application of the same transformation makes the process effective.
> Repeated application of Regular Expressions can perform Turing Complete computations.
> This works because the "needed state" is in the partially evaluated text itself.

Here is what Paul McJones (2019/02/16) commentary:

> I have admired the power and elegance of the lambda calculus since I first learned of it around 1970.
> And I have admired the elegance of the Wiki idea since I first ran across Ward Cunningham’s Wiki some years back.
> You’ve combined these ideas in a very interesting way, and you figured out a way to harness the power of web technologies (JavaScript, HTML, CSS, etc.) to implement them.

Personally – Pierre Grabolosa – I fully agree with those comments and I will furthermore add that I greatly appreciate the simple syntax that makes LambdaTalk easy enough for primary school kids to learn & use. As a matter of fact, Mr. Marty has lead Wiki workshops for local schools. The fact that LambdaTalk is a functional language which can explained by way of substitutions makes it even useful to help understand mathematics and – later – other programming paradigms.


### Future Developments | TODO

  * Use the new Block API in addition to the older Plugin API to enable LambdaTalk use within WordPress.
    - This may resolve a current limitation -- it seems the way WordPress processes shortcodes limits to a single LambdaTalk shortcode..
  * Refactor the LambdaTalk code to use an extensible architecture and modules.

## LambdaTalk

### Quick Intro

LambdaTalk is about producing Wiki content. By default, you type content. The following text is a valid LambdaTalk program:

```
Hello, world!
```

LambdaTalk formatting and programming works by *substitution*. LambdaTalk expressions are enclosed in curly braces (`{}`). If the first item within the curly braces is equivalent to a function, then this function is called with the rest of the items as parameters and the whole expression is replaced with the result of the function.

Example:

```
Hello, world! I am {- 2021 1983} years old.
````

In the above example, `{- 2021 1983}` will be replaced by `38` because `-` is a function which will receive `2021` and `1983` as parameters.

Other example:

```
Hello, world! I am {- 2021 1983} years old. {b Crazy} right?
```

Here, `b` is a function that will produce the necessary HTML and CSS so `Crazy` appears in **bold** weight.

Mr. Marty leverages the very rich HTML and JavaScript environments to offer a very rich and practical function library.

For more information and details, please read his intro to LambdaTalk:

  - http://lambdaway.free.fr/

### Using LambdaTalk with WordPress

#### Installing this plugin

Copy the `lambda` directory into `wp-content/plugins/lambda`. You may need to activate the plugin in your WordPress administration panel.

#### Using LambdaTalk within a page

Having installed the plugin, just enclose the parts that you want to be parsed as LambdaTalk within `[lambda]` and `[\lambda]` which is a WordPress syntax for [*enclosing shortcodes*](https://developer.wordpress.org/plugins/shortcodes/enclosing-shortcodes/).

