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

To deploy the dang thing (make sure to commit and push any changes first, as this builds from upstream master):
```
# Cloud Build the new container version
gcloud builds submit --tag gcr.io/jpco-cloud/web:0.70 .
# Cloud Run the new container version
gcloud run deploy --platform managed --image=gcr.io/jpco-cloud/web:0.70
```

## TODO

- Improve templating situation
- Get more inspo from https://github.com/jneen/balls and clean up serve.es
