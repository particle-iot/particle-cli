#!/usr/bin/env bash
set -e

echo "::::::::::::::::::::::::::::::::::::::::::::"
echo ":::: Updating Local CLI Wrapper Package ::::"
echo "::::::::::::::::::::::::::::::::::::::::::::"

shopt -s dotglob
shopt -s nullglob
PWD=$(pwd)
particle_dir=~/.particle

echo
echo ":::: Packaging CLI via npm :::::::::::::::::"

npm pack

echo

tgz_files=(${PWD}/particle-cli-*.tgz)

if [ ${#tgz_files[@]} -eq 1 ]; then
	pkg=${tgz_files[0]}
else
	PS3='Select your package (.tgz): '
	select file in "${tgz_files[@]}"
	do
		pkg=${file}
		break
	done
fi

user_dirs=(${particle_dir}/node-*/)

if [ ${#user_dirs[@]} -eq 1 ]; then
	node_dir=${user_dirs[0]}
else
	PS3='Please pick your node install directory: '
	select dir in "${user_dirs[@]}"
	do
		node_dir=${dir}
		break
	done
fi

echo
echo ":::: Installing CLI package ::::::::::::::::"
echo ":::: Destination: ${node_dir}"
echo ":::: Package: ${pkg}"

node_bin=${node_dir}/bin/node
npm_bin=${node_dir}/lib/node_modules/npm/bin/npm-cli.js

cd ${particle_dir}
npm_install_log=$(${node_bin} ${npm_bin} install ${pkg} --loglevel=verbose --color=always 2>&1 | tee /dev/tty)

if (echo $npm_install_log | grep --silent "No prebuilt binaries found")
then
	echo ":::: Error: It appears prebuild binaries for native modules are not available!"
	exit 1
fi

echo
echo ":::: done!"

