#!/usr/local/bin/es

cat tmpl/header.html
echo '<title>jpco.io | Not found</title>'
. script/build-nav.es $^*
echo '<main>'
echo '<p>'
echo 'Path "'^$^*^'" not found.'
