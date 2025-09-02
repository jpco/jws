# jpco's web site, served by the extensible shell

This is my website.

Maybe serving your personal site from a shell script isn't the best idea, but maybe I don't care.

To run the server really locally:
```
./serve.es
```

To run the server in a local docker container (for test dependencies):
```
sudo docker build -t es-srv .
sudo docker run -it --rm -p 8181:8080 es-srv
curl -i localhost:8181
```

To deploy the dang thing:
```
# Cloud Build the new container version. you'll have to increment the version
gcloud builds submit --tag gcr.io/jpco-cloud/web:0.70 .
# Cloud Run the new container version
gcloud run deploy --platform managed --image=gcr.io/jpco-cloud/web:0.70
```
