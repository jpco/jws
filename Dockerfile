FROM debian:latest
WORKDIR /usr/local/app

RUN apt-get update

# es dependencies
RUN apt-get install -y git make gcc libtool autoconf automake bison
RUN git clone https://github.com/wryun/es-shell
RUN cd es-shell && libtoolize -qi && autoreconf && ./configure CFLAGS=-O3 && make && make install

# server dependencies
RUN apt-get install -y ncat man

# copy over the whole repo, who cares
COPY . .

EXPOSE 8080

ENV IN_DOCKER true

ENTRYPOINT ["./serve.es"]
