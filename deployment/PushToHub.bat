@echo off
setlocal EnableDelayedExpansion


set /P revversion=<versionNo.txt

if "!revversion!"=="" (
    set /P revversion=1
) else (
    set /A revversion=revversion+1
)

echo %revversion% > versionNo.txt


echo building cloudconnect.scanrev.com:5000/ne-crosschain-loan:1.0.%revversion%
docker build  -f ../Dockerfile  -t cloudconnect.scanrev.com:5000/ne-crosschain-loan:1.0.%revversion%  ..

docker push cloudconnect.scanrev.com:5000/ne-crosschain-loan:1.0.%revversion%



echo all done
pause 

