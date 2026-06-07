// ua.js — browser detection stub (modern replacement)
var is_ie  = /Trident|MSIE/.test(navigator.userAgent);
var is_nav = !is_ie;
var is_major = parseInt(navigator.appVersion, 10) || 4;
