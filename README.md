# https://jpco.io/

Maybe [serving your personal site from a shell script](https://jpco.io/es/web-server.html) isn't the best idea, but maybe I don't care.

This isn't actually written in javascript.  Github just doesn't know what I mean by files with the ".es" extension.

## Notes to self on deployment

To run the server locally:
```
./serve.es
```

To run the server in a local docker container (for to test dependencies):
```
sudo docker build -t es-srv .
sudo docker run -it --rm -p 8181:8080 es-srv
curl -i localhost:8181
```

To deploy the dang thing, just run
```
./deploy.es
```
(make sure to push any changes first: the Dockerfile builds from HEAD, not the local directory!)

## TODO

- Improve templating situation
- Get inspo from https://github.com/jneen/balls
- Get even better inspo from http://werc.cat-v.org/
