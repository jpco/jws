FROM debian:stable-slim

# es install.
RUN	apt-get update && \
	apt-get install -y git make gcc libtool autoconf automake bison && \
	git clone https://github.com/wryun/es-shell && \
	cd es-shell && \
	libtoolize -i && \
	autoreconf && \
	./configure CFLAGS=-O3 LDFLAGS='-z pack-relative-relocs' && \
	make && \
	make install

# clean install 1 UNTESTED
# RUN git clone https://github.com/jpco/jws

FROM debian:stable-slim
WORKDIR /usr/local/app
COPY --from=0 /usr/local/bin/es /usr/local/bin/es
COPY --from=0 /usr/local/share/man/man1/es.1 /usr/local/share/man/man1/es.1
# COPY --from=0 /jws/* .  # clean install 2 UNTESTED

# Server install.
# Get dependencies.
RUN	apt-get update && \
	apt-get install -y ncat man file && \
	apt-get clean && \
	rm -rf /var/lib/apt/lists/*

# Dirty install from local directory
COPY . .

EXPOSE 8080

ENV IN_DOCKER=true

ENTRYPOINT ["./serve.es"]
