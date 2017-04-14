FROM ubuntu:16.04

RUN apt-get update
RUN apt-get install -y make
RUN apt-get install -y git
RUN apt-get install -y lua5.3

RUN useradd -ms /bin/sh urn

RUN mkdir /urn
RUN git clone https://gitlab.com/urn/urn.git /urn
RUN chown urn /urn -R

USER urn
WORKDIR /urn

RUN make all -j4

COPY urn-repl.lua urn-repl.lua
ENTRYPOINT lua5.3 urn-repl.lua
