FROM debian:stable-slim
WORKDIR /

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

# Clean install step 1
RUN git clone --separate-git-dir=/tmp/git-dir --depth=1 https://github.com/jpco/jws

FROM debian:stable-slim
WORKDIR /usr/local/app
# es install
COPY --from=0 /usr/local/bin/es /usr/local/bin/es
COPY --from=0 /usr/local/share/man/man1/es.1 /usr/local/share/man/man1/es.1
# Clean install step 2
COPY --from=0 /jws/ .

# Dirty install from local directory
# COPY . .

# Server install.
# Get dependencies.
RUN	apt-get update && \
	apt-get install -y ncat man file && \
	apt-get clean && \
	rm -rf /var/lib/apt/lists/*

EXPOSE 8080

ENV IN_DOCKER=true

ENTRYPOINT ["./serve.es"]
