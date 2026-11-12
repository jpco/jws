# https://jpco.io/

Maybe [serving your personal site from a shell script](https://jpco.io/es/web-server.html) isn't the best idea, but maybe I don't care.

The shell in question is [_es_](https://github.com/wryun/es-shell).
Much of the site is [about my work on _es_](https://jpco.io/es).

## Notes to self on deployment

To run the server locally:
```
./serve.es
```

To run the server in a local docker container (to test dependencies):
```
sudo docker build -t es-srv .
sudo docker run -it --rm -p 8181:8080 es-srv
curl -i localhost:8181
```

To deploy the dang thing, make sure any changes are pushed, and then run
```
./deploy.es
```

## TODO

- Improve templating situation
- Get inspo from https://github.com/jneen/balls
- Get even better inspo from http://werc.cat-v.org/
- Automatic page dates and sitemap.xml
