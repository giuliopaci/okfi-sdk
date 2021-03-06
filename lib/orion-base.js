var http = require('http');
var querystring = require('querystring');
var KS = require('./keystone-base.js');
module.exports.Orion = Orion;

var debuglog = function(str) {
//    console.log(str);
};

function Orion(cfg, k) {
    if(k) {
	this.keystone = k;
    } else if(cfg.keystone) {
	this.keystone = new KS.Keystone(
	    cfg.keystone
	);
    }
    this.host = cfg.host;
    this.port = cfg.port;
    if(cfg.service) {
	this.service = cfg.service;
	this.servicepath = cfg.servicepath;
    }
    // Configure authentication if user is set and keystone is available
    if(this.keystone) {
	if(cfg.user) {
	    if(cfg.service) {
		this.keystone.auth = KS.Keystone.user_to_keystone_auth(cfg.user, { "name": cfg.service });
	    } else {
		this.keystone.auth = KS.Keystone.user_to_keystone_auth(cfg.user);
	    }
	    this.keystone.token = null;
	    this.keystone.maxretry = 5;
	}
    }
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
    if(this.orion.service) {
	this.options.headers['fiware-service'] = this.orion.service;
	this.options.headers['fiware-servicepath'] = this.orion.servicepath;
    }

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
	debuglog("Sorry, event " + id + " not implemented.");
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
		debuglog("Unauthenticated");
		if(!act.noreauth)
		{
		    debuglog("Authenticate");
		    act.orion.keystone.token = null;
		    var a = act.orion.keystone.authenticate();
		    a.noreauth = true;
		    a.on('success', function(r, s) {
			act.orion.keystone.token = s.headers['x-subject-token'];
			if(act.orion.keystone.token)
			    act.options.headers['X-Auth-Token'] = act.orion.keystone.token;
			//debuglog(act.orion.keystone);
			act.end();
		    });
		    if(act._keystone_error_cb) {
			a.on('error', act._keystone_error_cb);
		    } 
		    a.end();
		    break;
		}
		debuglog("Authentication failed");
	    default:
		if(act._error_cb) {
		    var myres = null;
		    if(str) {
			try
			{ myres = JSON.parse(str); }
			catch (e)
			{ myres = str; } 
		    }
		    act._error_cb(myres, response);
		}
	    }
	});
    };
    var firerequest = function(count, e) {
	var req = http.request(act.options, callback);
	if( count < act.orion.keystone.maxretry ) {
	    req.on('error', function(e) {
		setTimeout(
		    function () {
			//TODO: better logging
			debuglog("RETRY: " + (count+1) );
			//debuglog(e);
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

//
// Orion NGSI10 operations
//

Orion.prototype.queryContext = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/queryContext" }, 'body': body }, this );
};

Orion.prototype.updateContext = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/updateContext" }, 'body': body }, this );
};

// convenience method
Orion.prototype.updateContextWithAction = function(action, body) {
    var updateContext = { "contextElements": body, "updateAction": action };
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/updateContext" }, 'body': updateContext }, this );
};

Orion.prototype.subscribeContext = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/subscribeContext" }, 'body': body }, this );
};

Orion.prototype.updateContextSubscription = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/updateContextSubscription" }, 'body': body }, this );
};


Orion.prototype.unsubscribeContext = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/unsubscribeContext" }, 'body': body }, this );
};

//
// Orion NGSI10 convenience operations
//

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

//
// Orion NGSI10 convenience operations for subscriptions
//

Orion.prototype.listSubscriptions = function() {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextSubscriptions" } }, this );
};

Orion.prototype.getSubscription = function(id) {
    return new OrionAction( { 'options': { 'method': "GET", 'path': "/v1/contextSubscriptions/" + id } }, this );
};

Orion.prototype.ORIONcreateSubscription = function(body) {
    return new OrionAction( { 'options': { 'method': "POST", 'path': "/v1/contextSubscriptions" }, 'body': body }, this );
};

Orion.prototype.ORIONupdateSubscription = function(id, body) {
    return new OrionAction( { 'options': { 'method': "PUT", 'path': "/v1/contextSubscriptions/" + id }, 'body': body }, this );
};

Orion.prototype.ORIONdeleteSubscription = function(id) {
    return new OrionAction( { 'options': { 'method': "DELETE", 'path': "/v1/contextSubscriptions/" + id } }, this );
};

//
// OKFI convenience operation for subscriptions
//
var check_in_attributes = function(attributes,name,value) {
    for(var i = attributes.length - 1; i >= 0; i--) {
	if( (attributes[i].name == name) && (attributes[i].value == value) ) {
	    return true;
	}
    }
    return false;
};

Orion.prototype.listSubscriptions = function(condition) {
    var req = new OrionAction(null, this);
    var orion = this;
    var query = {
	"entities": [
	    { "type": "Subscription", isPattern: "true", "id":".*" }
	]
    };
    var req2 = orion.queryContext(query)
	    .on('success', function(res) {
		if(res.contextResponses && condition) {
		    for(var i = res.contextResponses.length - 1; i >= 0; i--) {
			if(!check_in_attributes(res.contextResponses[i].contextElement.attributes, "name", condition.name)) {
			    res.contextResponses.splice(i, 1);
			}
		    }
		}
		req._success_cb(res);
	    })
	    .on('error', function(res) {
		req._error_cb(res);
	    });
    req.end = function() {
	req2.end();
    };
    return req;
};

Orion.prototype.createSubscription = function(body, name) {
    var req = new OrionAction(null, this);
    var orion = this;
    var req2 = orion.subscribeContext(body)
	    .on('success', function(res){
		if(res.subscribeResponse.subscriptionId) {
		    var entity = {
			"type" : "Subscription",
			"isPattern": false,
			"id": "Subscription-" + res.subscribeResponse.subscriptionId,
			"attributes" : [
			    {
				"name" : "subscriptionId",
				"type" : "string",
				"value" : res.subscribeResponse.subscriptionId
			    }
			]
		    };
		    if(name) {
			entity.attributes.push(
			    {
				"name" : "name",
				"type" : "string",
				"value" : name
			    });
		    }
		    orion.createEntity("Subscription-" + res.subscribeResponse.subscriptionId, entity)
			.on('success', function(res) {
			    req._success_cb(res);
			})
			.on('error', function(res) {
			    res.error_okfi = "Unable to save Subscription ID";
			    req._error_cb(res);
			})
			.end();
		} else {
		    res.error_okfi = "Unable to get Subscription ID";
		    req._error_cb(res);
		}
	    })
	    .on('error', req._error_cb );
    req.end = function() {
	req2.end();
    };
    return req;
};

Orion.prototype.deleteSubscription = function(id) {
    var req = new OrionAction(null, this);
    var orion = this;
    var req2 = orion.ORIONdeleteSubscription(id.replace("Subscription-",""))
			.on('success', function(res) {
			    orion.deleteEntity(id)
				.on('success', function(res) {
				    req._success_cb(res);
				})
				.on('error', function(res) {
				    req._error_cb(res);
				})
				.end();
			})
			.on('error', function(res) {
			    req._error_cb(res);
			});
    req.end = function() {
	req2.end();
    };
    return req;
};

Orion.prototype.updateSubscription = function(id, body) {
    var req = new OrionAction(null, this);
    var orion = this;
    body.subscriptionId = id.replace("Subscription-","");
    //delete body.entities;
    //delete body.reference;
    //delete body.attributes;
    var req2 = orion.ORIONupdateSubscription(id.replace("Subscription-",""), body)
	    .on('success', function(res) {
		req._success_cb(res);
	    })
	    .on('error', function(res) {
		req._error_cb(res);
	    });
    req.end = function() {
	req2.end();
    };
    return req;
};


Orion.prototype.recreateSubscription = function(body, name) {
    var req = new OrionAction(null, this);
    var orion = this;
    var req2 = orion.listSubscriptions( { "name": name} )
	    .on('success', function(res) {
		if(res.contextResponses && res.contextResponses[0]) {
		    orion.deleteSubscription(res.contextResponses[0].contextElement.id)
			.on('success', function(res) {
			    orion.createSubscription(body, name)
				.on('success', function(res) {
				    req._success_cb(res);
				})
				.on('error', function(res) {
				    req._error_cb(res);
				}).end();
			})
			.on('error', function(res) {
			    req._error_cb(res);
			}).end();
		} else {
		    orion.createSubscription(body, name)
			.on('success', function(res) {
			    req._success_cb(res);
			})
			.on('error', function(res) {
			    req._error_cb(res);
			}).end();
		}
	    })
	    .on('error', function(res) {
		req._error_cb(res);
	    });
    req.end = function() {
	req2.end();
    };
    return req;
};
