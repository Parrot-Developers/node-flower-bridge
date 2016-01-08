./bridge running
if [ "$?" == 1 ]
then
	ip=`/sbin/ifconfig eth0 | grep 'inet addr:' | cut -d: -f2 | awk '{ print $1}'`
	(echo "Crash Flower Bridge" && \
		echo "ip: $ip" && \
		echo "" && \
		echo "trace.log:" && \
		cat trace.log) | \
		mail -s "Flower Bridge crashed" "bruno.sautron@parrot.com"
	./bridge restart > /dev/null
fi
