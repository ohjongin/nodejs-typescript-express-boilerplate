#!/bin/sh

echo "PWD:" ${PWD}
echo "BASH_SOURCE:" "$0"

script_dir="$( dirname -- "$BASH_SOURCE"; )";
echo "script_dir:" $script_dir

cd ${script_dir}
last_path=$(basename $(dirname $0))
echo "last_path:" $last_path

rm -rf dist
rm -rf node_modules

npm i
npx tsc