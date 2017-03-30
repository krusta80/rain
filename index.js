'use strict';
require('dotenv').load();
var http = require('http');
var fs = require('fs');
const DarkSky = require('dark-sky');
const forecast = new DarkSky(process.env.DARK_SKY_API_KEY);
const THRESHOLD = 0.70;
const MINUTES = 60;
const LAST_RAIN_FILE = 'last_rain.txt';

//require the Twilio module and create a REST client
var client = require('./node_modules/twilio/lib')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
var textTo = '+15162421245';
var textFrom = '+15162657393';
var rainUrl = 'http://api.giphy.com/v1/gifs/search?q=funny%20rain%20weather&api_key=dc6zaTOxFJmzC';
var noRainUrl = 'http://api.giphy.com/v1/gifs/search?q=sunny&api_key=dc6zaTOxFJmzC';
var rainMessage = 'Rain Expected';
var noRainMessage = 'The Coast is Clear';
var latlons = {
 sloan: {
 	lat: '40.7559093',
 	lon: '-73.9646646'
 }
};
var lastRainTime = fs.readFileSync(LAST_RAIN_FILE).toString();

checkForecast(lastRainTime);

function checkForecast(lastRainTime){
	forecast
	    .latitude(latlons.sloan.lat)            // required: latitude, string.
	    .longitude(latlons.sloan.lon)          // required: longitude, string.
	    //.time('2016-01-28')             // optional: date, string 'YYYY-MM-DD'.
	    //.units('ca')                    // optional: units, string, refer to API documentation.
	    .language('en')                 // optional: language, string, refer to API documentation.
	    //.exclude('hourly,daily')      // optional: exclude, string, refer to API documentation.
	    //.extendMinutely(true)             // optional: extend, boolean, refer to API documentation.
	    .get()                          // execute your get request.
	    .then(res => {                  // handle your success response.
	        var json = res;
			//console.log(json);
	        
	        if(process.env.CHECK_WORKDAY){
	        	var hour;
	        	var rainToday = false;
	        	for(var h = 0; h < process.env.WORKDAY_LENGTH; h++){
	        		hour = json.hourly.data[h];
	        		if(hour.precipProbability >= THRESHOLD){
	        			getGiphyAndSendMMS(rainUrl, Number(hour.time), rainMessage, hour.precipProbability*100+'%');
	        			rainToday = true;
	        			break;
	        		}
	        	}
	        	if(!rainToday) getGiphyAndSendMMS(noRainUrl, 0, noRainMessage, 0, true);
	        }

	        //	always check ahead
	        var minute;
	        var rain = false;
	    	for(var m = 0; m < Math.min(json.minutely.data.length, MINUTES); m++){
	    		minute = json.minutely.data[m];
	    		if(minute.precipProbability >= THRESHOLD){
	    			fs.writeFileSync(LAST_RAIN_FILE, minute.time);
	    			rain = true;
	    			if(minute.time - lastRainTime >= MINUTES*60) 
	    				getGiphyAndSendMMS(rainUrl, Number(minute.time), rainMessage, minute.precipProbability*100+'%');
	    			break;
	    		}
	    	}
	    	if(!rain && Date.now() - lastRainTime*1000 >= MINUTES*60000 && Date.now() - lastRainTime*1000 < (MINUTES+2)*60000) 
	    		getGiphyAndSendMMS(noRainUrl, 0, noRainMessage, 0, true);
	    })
	    .catch(err => {                 // handle your error response.
	        console.log(err)
	    });
}

function getGiphyAndSendMMS(giphyUrl, timestamp, message, percentage, allClear){
	http.get(giphyUrl, function(res){
	    var body = '';

	    res.on('data', function(chunk){
	        body += chunk;
	    });

	    res.on('end', function(){
	        var response = JSON.parse(body);
	        var id = response.data[Math.floor(Math.min(35,response.data.length)*Math.random())].id;
	        //console.log("Got a response: ", fbResponse);
	        if(allClear) sendAllClear(id);
	        else sendMMS(timestamp, id, message, percentage);
	    });
	}).on('error', function(e){
	      console.log("Got an error: ", e);
	});
}

function sendAllClear(url){
	console.log("url is", url);
	var today = process.env.CHECK_WORKDAY ? "Today " : "";
	client.messages.create({

	    to: textTo, // Any number Twilio can deliver to
	    from: textFrom, // A number you bought from Twilio and can use for outbound communication
	    body: noRainMessage+' '+today+'\n('+(new Date(Date.now())).toLocaleString()+')',
	    mediaUrl: 'http://i.giphy.com/' + url + '.gif'

	}, function (err, responseData) {

	    console.log(responseData);

	});
}

function sendMMS(timestamp, url, message, percentage){
	console.log("url is", url);
	console.log("timestamp is", timestamp);
	console.log("converted is", (new Date(timestamp*1000)).toString());
	var today = process.env.CHECK_WORKDAY ? "Today " : "";
	client.messages.create({

	    to: textTo, // Any number Twilio can deliver to
	    from: textFrom, // A number you bought from Twilio and can use for outbound communication
	    body: message+' '+today+'('+percentage+')! \n('+(new Date(timestamp*1000)).toLocaleString()+')',
	    mediaUrl: 'http://i.giphy.com/' + url + '.gif'

	}, function (err, responseData) {

	    console.log(responseData);

	});
}
