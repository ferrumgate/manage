#!/bin/bash
cd ../rest.portal
bash docker.build.sh --force --push
cd ../ui.portal
bash docker.build.sh --force --push
cd ../job.log
bash docker.build.sh --force --push
cd ../job.task
bash docker.build.sh --force --push
cd ../job.admin
bash docker.build.sh --force --push

#!/bin/bash
#cd ../rest.portal
#bash docker.build.sh --force
#cd ../ui.portal
#bash docker.build.sh --force
#cd ../job.log
#bash docker.build.sh --force
#cd ../job.task
#bash docker.build.sh --force
#cd ../job.admin
#bash docker.build.sh --force
