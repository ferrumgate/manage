#!/bin/bash

set -e
first="$1"
second="$2"
npm run build
rm -rf node_modules/secure.es.proxy
mkdir -p node_modules/secure.es.proxy

version=$(cat package.json | grep version | cut -d: -f2 | tr -d , | tr -d \" | tr -d " ")
docker build -t secure.es.proxy . --no-cache
docker tag secure.es.proxy "secure.es.proxy:$version"
echo "secure.es.proxy:$version builded"
docker tag secure.es.proxy "registry.ferrumgate.zero/ferrumgate/secure.es.proxy:$version"
docker tag secure.es.proxy registry.ferrumgate.zero/ferrumgate/secure.es.proxy:latest
docker tag secure.es.proxy "ferrumgate/secure.es.proxy:$version"

execute() {
    docker push registry.ferrumgate.zero/ferrumgate/secure.es.proxy:"$version"
    docker push registry.ferrumgate.zero/ferrumgate/secure.es.proxy:latest
    if [ "$first" == "--push" ] || [ "$second" == "--push" ]; then
        docker push ferrumgate/secure.es.proxy:"$version"
    fi

}

if [ "$first" == "--force" ] || [ "$second" == "--force" ]; then
    execute
    exit
else
    while true; do
        read -r -p "do you want push to local registry y/n " yn
        case $yn in
        [Yy]*)
            execute
            break
            ;;
        [Nn]*) exit ;;
        *) echo "please answer yes or no." ;;
        esac
    done
fi
