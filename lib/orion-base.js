var http = require('http');
var querystring = require('querystring');
var KS = require('./keystone-base.js');
module.exports.Orion = Orion;


function Orion(cfg, k) {
    this.keystone = k;
    this.host = cfg.host;
    this.port = cfg.port;
}

function OrionAction(cfg, o) {
    // Reference to the OrionAction parent
    this.orion = o;
    this._error_cb = o.default_error_handler;
    if(!cfg) return this;

    // Initial setup of OrionAction parameters
    this.options = cfg.options;
    this.body = cfg.body;
    this.query = cfg.query;
    this.type = cfg.type;

    // Prepare HTTP request headers
    if(!this.options.headers) this.options.headers = {};
    this.options.headers['Accept'] = "application/json";
    if(this.orion.keystone.token)
	this.options.headers['X-Auth-Token'] = this.orion.keystone.token;

    // Prepare HTTP request host
    this.options.host = this.orion.host;
    if(this.orion.port)
	this.options.port = this.orion.port;

    // Prepare HTTP request query
    if(this.query) {
	this.options.path += "?" + querystring.stringify(this.query);
    }
    // Prepare HTTP request body
    if(this.body) {
	if(this.options.method != "GET" && this.options.method != "HEAD" && this.options.method != "DELETE") {
	    this.options.headers['Content-type'] = "application/json";
	}
	this.bodydata = JSON.stringify(this.body);
	this.options["Content-Length"] = this.bodydata.length;
    }
    return this;
}

OrionAction.prototype.on = function(id, cb) {
    switch (id) {
    case "error":
	this._error_cb = cb;
	break;
    case "success":
	this._success_cb = cb;
	break;
    default:
	console.log("Sorry, event " + id + " not implemented.");
    }
    return this;
};

OrionAction.prototype.end = function() {
    if(!this.options.headers['X-Auth-Token'])
	this.options.headers['X-Auth-Token'] = "FIXME";
    var act = this;
    var callback = function(response) {
	// De-chunk response into str
	var str = '';
	response.on('data', function (chunk) { str += chunk; });

	response.on('end', function () {
	    switch(response.statusCode){
	    case 200:
	    case 201:
	    case 204:
		if(act._success_cb) {
		    var res = null;
		    if(str) {
			res = JSON.parse(str);
		    }
		    act._success_cb(res, response);
		}
		break;
	    case 401:
		//TODO: try to authenticate only X (1?) time
		console.log("Unauthenticated");
		if(!act.noreauth)
		{
		    console.log("Authenticate");
		    act.orion.keystone.token = null;
		    var a = act.orion.keystone.authenticate();
		    a.noreauth = true;
		    a.on('success', function(r, s) {
			act.orion.keystone.token = s.headers['x-subject-token'];
			if(act.orion.keystone.token)
			    act.options.headers['X-Auth-Token'] = act.orion.keystone.token;
			//console.log(act.orion.keystone);
			act.end();
		    });
		    if(act._keyston_error_cb) {
			a.on('error', act._keyston_error_cb);
		    } 
		    a.end();
		    break;
		}
		console.log("Authentication failed");
	    default:
		if(act._error_cb) {
		    var myres = null;
		    if(str) {
			myres = JSON.parse(str);
		    }
		    act._error_cb(myres, response);
		}
	    }
	});
    };
    var firerequest = function(count, e) {
	var req = http.request(act.options, callback);
	if( count < act.orion.maxretry ) {
	    req.on('error', function(e) {
		setTimeout(
		    function () {
			//TODO: better logging
			console.log("RETRY: " + (count+1) );
			//console.log(e);
			firerequest(count+1, e);
		    }, 1000*(count+1));
	    } );
	} else {
	    req.on('error', function(e) {
		act._error_cb(
		    { 'error': { message: 'The connection to the server failed.',
				 code: 000,
				 title: 'Connection Error'
			       }
		      , 'connerror': e }, null);} );
	}
	if(act.bodydata) {
	    req.write(act.bodydata);
	}
	req.end();
    };
    firerequest(0);
};


Orion.prototype.createEntity = function(id, body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/contextEntities/" + id }, 'body': body }, this );
};

Orion.prototype.getEntity = function(id) {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextEntities/" + id } }, this );
};

Orion.prototype.deleteEntity = function(id) {
    return new OrionAction( { 'options': { 'method': "DELETE", 'path': "/v1/contextEntities/" + id } }, this );
};

Orion.prototype.updateEntity = function(id, body) {
    return new OrionAction( { 'options': { 'method': "PUT", 'path': "/v1/contextEntities/" + id }, 'body': body }, this );
};

// Code below has not been tested

Orion.prototype.listEntities = function() {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextEntities" } }, this );
};

Orion.prototype.createEntities = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/contextEntities" }, 'body': body }, this );
};

Orion.prototype.createEntityAttribute = function(id, aid, body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/contextEntities/" + id + "/attributes/" + aid}, 'body': body }, this );
};

Orion.prototype.getEntityAttribute = function(id, aid) {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextEntities/" + id + "/attributes/" + aid} }, this );
};

Orion.prototype.deleteEntityAttribute = function(id, aid) {
    return new OrionAction( { 'options': { 'method': "DELETE", 'path': "/v1/contextEntities/" + id + "/attributes/" + aid} }, this );
};

Orion.prototype.updateEntityAttribute = function(id, aid, body) {
    return new OrionAction( { 'options': { 'method': "PUT", 'path': "/v1/contextEntities/" + id + "/attributes/" + aid}, 'body': body }, this );
};

Orion.prototype.getEntityAttributeWithValue = function(id, aid, value) {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextEntities/" + id + "/attributes/" + aid + "/" + value} }, this );
};

Orion.prototype.deleteEntityAttributeWithValue = function(id, aid, value) {
    return new OrionAction( { 'options': { 'method': "DELETE", 'path': "/v1/contextEntities/" + id + "/attributes/" + aid + "/" + value} }, this );
};

Orion.prototype.createEntityAttributeWithValue = function(id, aid, value) {
    return new OrionAction( { 'options': { 'method': "PUT", 'path': "/v1/contextEntities/" + id + "/attributes/" + aid + "/" + value} }, this );
};

Orion.prototype.listSubscriptions = function() {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextSubscriptions" } }, this );
};

Orion.prototype.createSubscriptions = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/contextSubscriptions" }, 'body': body }, this );
};

Orion.prototype.createSubscription = function(id, body) {
    return new OrionAction( { 'options': { 'method': "PUT", 'path': "/v1/contextSubscriptions/" + id }, 'body': body }, this );
};

Orion.prototype.getSubscription = function(id) {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextSubscriptions/" + id } }, this );
};

Orion.prototype.deleteSubscription = function(id) {
    return new OrionAction( { 'options': { 'method': "DELETE", 'path': "/v1/contextSubscriptions/" + id } }, this );
};

Orion.prototype.queryContext = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/queryContext" }, 'body': body }, this );
};

/* NGSI9
GET 	/v1/registry/contextEntities/{EntityId} 	Dis
POST 	/v1/registry/contextEntities/{EntityId} 	Reg
GET 	/v1/registry/contextEntities/{EntityId}/attributes 	-
POST 	/v1/registry/contextEntities/{EntityId}/attributes 	-
GET 	/v1/registry/contextEntities/{EntityId}/attributes/{attributeName} 	Dis
POST 	/v1/registry/contextEntities/{EntityId}/attributes/{attributeName} 	Reg
GET 	/v1/registry/contextEntities/{EntityId}/attributeDomains/{attributeDomainName} 	Dis
POST 	/v1/registry/contextEntities/{EntityId}/attributeDomains/{attributeDomainName} 	Reg
GET 	/v1/registry/contextEntityTypes/{typeName} 	Dis
POST 	/v1/registry/contextEntityTypes/{typeName} 	Reg
GET 	/v1/registry/contextEntityTypes/{typeName}/attributes 	-
POST 	/v1/registry/contextEntityTypes/{typeName}/attributes 	-
GET 	/v1/registry/contextEntityTypes/{typeName}/attributes/{attributeName} 	Dis
POST 	/v1/registry/contextEntityTypes/{typeName}/attributes/{attributeName} 	Reg
GET 	/v1/registry/contextEntityTypes/{typeName}/attributeDomains/{attributeDomainName} 	Dis
POST 	/v1/registry/contextEntityTypes/{typeName}/attributeDomains/{attributeDomainName} 	Reg
POST 	/v1/registry/contextAvailabilitySubscriptions 	S-A
PUT 	/v1/registry/contextAvailabilitySubscriptions/{subscriptionId} 	S-A
DELETE 	/v1/registry/contextAvailabilitySubscriptions/{subscriptionId}
*/

/* NGSI10
OK:
GET 	/v1/contextEntities/{EntityID} 	R
PUT 	/v1/contextEntities/{EntityID} 	U
POST 	/v1/contextEntities/{EntityID} 	C
DELETE 	/v1/contextEntities/{EntityID} 	D

TODO:
*GET 	/v1/contextEntities 	R
*POST 	/v1/contextEntities 	C
-GET 	/v1/contextEntities/{EntityID}/attributes 	-
-PUT 	/v1/contextEntities/{EntityID}/attributes 	-
-POST 	/v1/contextEntities/{EntityID}/attributes 	-
-DELETE 	/v1/contextEntities/{EntityID}/attributes 	-
*GET 	/v1/contextEntities/{EntityID}/attributes/{attributeName} 	R
*POST 	/v1/contextEntities/{EntityID}/attributes/{attributeName} 	C
*PUT 	/v1/contextEntities/{EntityID}/attributes/{attributeName} 	U
*DELETE 	/v1/contextEntities/{EntityID}/attributes/{attributeName} 	D
*GET 	/v1/contextEntities/{EntityID}/attributes/{attributeName}/{valueID} 	R
*PUT 	/v1/contextEntities/{EntityID}/attributes/{attributeName}/{valueID} 	U
*DELETE 	/v1/contextEntities/{EntityID}/attributes/{attributeName}/{valueID} 	D
GET 	/v1/contextEntities/{EntityID}/attributeDomains/{attributeDomainName} 	R
GET 	/v1/contextEntityTypes/{typeName} 	R
-GET 	/v1/contextEntityTypes/{typeName}/attributes 	-
GET 	/v1/contextEntityTypes/{typeName}/attributes/{attributeName} 	R
GET 	/v1/contextEntityTypes/{typeName}/attributeDomains/{attributeDomainName} 	R
*POST 	/v1/contextSubscriptions 	S
*GET 	/v1/contextSubscriptions 	R
*GET 	/v1/contextSubscriptions/{subscriptionID} 	R
*PUT 	/v1/contextSubscriptions/{subscriptionID} 	S
*DELETE 	/v1/contextSubscriptions/{subscriptionID} 	S
GET 	/v1/contextTypes 	R
GET 	/v1/contextTypes{typename} 	R
*/
