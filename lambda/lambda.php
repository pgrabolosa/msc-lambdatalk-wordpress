<?php

/**
 * Plugin Name: LambdaTalk Processors
 */

function lambda_activate() { 
  $jsUrl  = plugins_url( 'lambda.js' , __FILE__ );
  $cssUrl = plugins_url( 'lambda.css', __FILE__ );
  
  wp_enqueue_style( 'style-lambda', $cssUrl );
  wp_enqueue_script( 'script-lambda', $jsUrl, $footer=true );
}
add_action( 'wp_enqueue_scripts', 'lambda_activate');

function lambda_shortcode( $atts = array(), $content = null ) {
  return '<span class="lambdatalk-out"><pre>'.$content.'</pre></span>';
}
add_shortcode( 'lambda', 'lambda_shortcode' );
