# on startup always ping testalator web
ip=$(ifconfig | awk -F':' '/inet addr/&&!/127.0.0.1/{split($2,_," ");print _[1]}')
gateway=$(/sbin/ip route | awk '/default/ { print $3 }')
build=$(git rev-parse --short HEAD)

# check out what this bench's device name is
echo '{"device":"'$DEVICE'", "ip":"'$ip'"}'
curl -H 'Content-Type: application/json' -d '{"name":"'$DEVICE'", "ip":"'$ip'", "gateway":"'$gateway'", "build": "'$build'"}' testalator.herokuapp.com/bench