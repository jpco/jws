#!/usr/local/bin/es

fn deploy image {
	gcloud builds submit --tag $image . &&
	gcloud run deploy --platform managed --image=$image
}

if {!~ `` \n {git status --porcelain} ''} {
	echo >[1=2] commit and push before you deploy
	exit 1
}

deploy gcr.io/jpco-cloud/web:0.76
