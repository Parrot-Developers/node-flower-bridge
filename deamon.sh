sudo ./run running
if [ "$?" == 1 ]
then
	echo "CRASH DETECTED" > /dev/pts/0
	sudo ./run restart
fi
