FROM ubuntu:16.04

RUN apt-get update
RUN apt-get install -y git
RUN apt-get install -y luajit
RUN apt-get install -y htop

RUN mkdir /urn
RUN git clone https://gitlab.com/urn/urn.git /urn

ENTRYPOINT cd /urn && luajit tacky/cli.lua
