var http = require('http');
var querystring = require('querystring');
module.exports.Keystone = Keystone;
module.exports.KeystoneAction = KeystoneAction;

var debuglog = function(str) {
//    console.log(str);
}:

function Keystone(cfg) {
    this.token = cfg.os_token;
    this.host = cfg.host;
    this.port = cfg.port;
    this.auth = cfg.auth;
    this.maxretry = cfg.maxretry;
    this.default_error_handler = cfg.default_error_handler;
}

function KeystoneAction(cfg, k) {
    // Reference to the KeystoneAction parent
    this.keystone = k;
    this._keystone_error_cb = k.default_error_handler;
    if(!cfg) return this;

    // Initial setup of KeystoneAction parameters
    this.options = cfg.options;
    this.body = cfg.body;
    this.query = cfg.query;
    this.type = cfg.type;

    // Prepare HTTP request headers
    if(!this.options.headers) this.options.headers = {};
    this.options.headers['Accept'] = "application/json";
    if(this.keystone.token)
	this.options.headers['X-Auth-Token'] = this.keystone.token;

    // Prepare HTTP request host
    this.options.host = this.keystone.host;
    if(this.keystone.port)
	this.options.port = this.keystone.port;

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

KeystoneAction.prototype.on = function(id, cb) {
    switch (id) {
    case "error":
	this._keystone_error_cb = cb;
	break;
    case "success":
	this._success_cb = cb;
	break;
    default:
	debuglog("Sorry, event " + id + " not implemented.");
    }
    return this;
};

var _typearraytopath = function(type) {
    if (Array.isArray(type))
	return type.map(encodeURIComponent).join('/');
    else
	return encodeURIComponent(type);
};

var _typearraytotype = function(type) {
    if (Array.isArray(type)) {
	if(type.length & 1)
	    return type[type.length-1];
	else
	    return type[type.length-2];
    }
    return type;
};

Keystone.user_to_keystone_auth = function(user,domain,project)
{
    var auth = {
            "identity": {
		"methods": [
                    "password"
		],
		"password": {
                    "user": {
			"domain": {
			    "name": domain.name
			},
			"name": user.name,
			"password": user.password
                    }
		}
            }
    };
    if(domain && project){
            auth.scope = {
		"project": {
                    "domain": {
			"name": domain.name
                    },
                    "name": project.name
		}
            };
    } else if(domain){
            auth.scope = {
                    "domain": {
			"name": domain.name
                    }
		};
    }
    return auth;
};

Keystone.prototype.listSCIMEntities = function(type, query) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "GET", 'path': "/v3/OS-SCIM/" + _typearraytopath(type) }, 'query': query }, this );
};

Keystone.prototype.createSCIMEntity = function(type, body) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "POST", 'path': "/v3/OS-SCIM/" + _typearraytopath(type) }, 'body': body }, this );
};

Keystone.prototype.getSCIMEntity = function(type, id) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "GET", 'path': "/v3/OS-SCIM/" + _typearraytopath(type) + "/" + id } }, this );
};

Keystone.prototype.deleteSCIMEntity = function(type, id) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "DELETE", 'path': "/v3/OS-SCIM/" + _typearraytopath(type) + "/" + id } }, this );
};

Keystone.prototype.updateSCIMEntity = function(type, id, body) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "PATCH", 'path': "/v3/OS-SCIM/" + _typearraytopath(type) + "/" + id }, 'body': body }, this );
};

Keystone.prototype.fullUpdateSCIMEntity = function(type, id, body) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "PUT", 'path': "/v3/OS-SCIM/" + _typearraytopath(type) + "/" + id }, 'body': body }, this );
};

Keystone.prototype.listEntities = function(type, query) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "GET", 'path': "/v3/" + _typearraytopath(type) }, 'query': query }, this );
};

Keystone.prototype.createEntity = function(type, body) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "POST", 'path': "/v3/" + _typearraytopath(type) }, 'body': body }, this );
};

Keystone.prototype.getEntity = function(type, id) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "GET", 'path': "/v3/" + _typearraytopath(type) + "/" + id } }, this );
};

Keystone.prototype.deleteEntity = function(type, id) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "DELETE", 'path': "/v3/" + _typearraytopath(type) + "/" + id } }, this );
};

Keystone.prototype.updateEntity = function(type, id, body) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "PATCH", 'path': "/v3/" + _typearraytopath(type) + "/" + id }, 'body': body }, this );
};

Keystone.prototype.addGrant = function(type, id) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "PUT", 'path': "/v3/" + _typearraytopath(type) + "/" + id } }, this );
};

Keystone.prototype.checkGrant = function(type, id) {
    return new KeystoneAction( { 'type': _typearraytotype(type), 'options': { 'method': "PUT", 'path': "/v3/" + _typearraytopath(type) + "/" + id } }, this );
};

Keystone.prototype.authenticate = function(body) {
    if(!body) {
	body = { 'auth': this.auth };
    }
    return new KeystoneAction( { 'options': { 'method': "POST", 'path': "/v3/auth/tokens" }, 'body': body }, this );
};

Keystone.prototype.validateToken = function(token) {
    if(!token) {
	token = this.token;
    }
    return new KeystoneAction( { 'options': { 'method': "GET", 'path': "/v3/auth/tokens", 'headers': { 'X-Subject-Token': token }} }, this );
};

Keystone.prototype.checkToken = function(token) {
    if(!token) {
	token = this.token;
    }
    return new KeystoneAction( { 'options': { 'method': "HEAD", 'path': "/v3/auth/tokens", 'headers': { 'X-Subject-Token': token }} }, this );
};

Keystone.prototype.revokeToken = function(token) {
    if(!token) {
	token = this.token;
    }
    return new KeystoneAction( { 'options': { 'method': "HEAD", 'path': "/v3/auth/tokens", 'headers': { 'X-Subject-Token': token }} }, this );
};

KeystoneAction.prototype.setParams = function(p) {
    if(typeof p.notfoundnoerror !== 'undefined')
	this.notfoundnoerror = p.notfoundnoerror;
    if(typeof p.noreauth!== 'undefined')
	this.noreauth = p.noreauth;
    return this;
};

KeystoneAction.prototype.end = function() {
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
		    act.keystone.token = null;
		    var a = act.keystone.authenticate();
		    a.noreauth = true;
		    a.on('success', function(r, s) {
			act.keystone.token = s.headers['x-subject-token'];
			if(act.keystone.token)
			    act.options.headers['X-Auth-Token'] = this.keystone.token;
			//debuglog(act.keystone);
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
		if(act._keystone_error_cb) {
		    var myres = null;
		    if(str) {
			myres = JSON.parse(str);
		    }
		    act._keystone_error_cb(myres, response);
		}
	    }
	});
    };
    var firerequest = function(count, e) {
	var req = http.request(act.options, callback);
	if( count < act.keystone.maxretry ) {
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
		act._keystone_error_cb(
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

Keystone.prototype.entity_type = {'domains':'domain','users':'user','projects':'project','groups':'group','credentials':'credential','services':'service','endpoints':'endpoints','roles':'role','role_assignments':'role_assignment','policies':'policy'};

Keystone.prototype.getOrCreateEntity = function(type, desired_entity) {
    var req = new KeystoneAction(null, this);
    var req2 = this.listEntities(type,  desired_entity)
	.on('success', function(res){
	    if(! res[req2.type].length) {
		var b = {};
		b[this.keystone.entity_type[req2.type]] = desired_entity;
		this.keystone.createEntity(type, b )
		    .on('success', function(res) { req._success_cb(res[this.keystone.entity_type[req2.type]]); } )
		    .on('error', req._keystone_error_cb )
		    .end();
	    } else {
		req._success_cb(res[req2.type][0]);
	    }
	})
	.on('error', req._keystone_error_cb );
    req.end = function() {
	req2.end();
    };
    return req;
};

Keystone.prototype.getOrCreateSCIMEntity = function(type, desired_entity) {
    var req = new KeystoneAction(null, this);
    var b = {};
    if(desired_entity.domain_id) {
	b.domain_id = desired_entity.domain_id;
    }
    if(desired_entity.name) {
	if(desired_entity.domain_id) {
	    b.name = desired_entity.domain_id + "#" + desired_entity.name;
	}
	else {
	    b.name = desired_entity.name;
	}
    }
    if(desired_entity.id) {
	b.id = desired_entity.id;
    }
    var req2 = this.listEntities('roles', b)
	.on('success', function(res){
	    if(! res[req2.type].length) {
		this.keystone.createSCIMEntity(type, desired_entity )
		    .on('success', function(res) { req._success_cb(res[this.keystone.entity_type[req2.type]]); } )
		    .on('error', req._keystone_error_cb )
		    .end();
	    } else {
		var out = res[req2.type][0];
		out.name = desired_entity.name;
		out.domain_id = desired_entity.domain_id;
		out.schemas = desired_entity.schemas;
		req._success_cb(out);
	    }
	})
	    .on('error', req._keystone_error_cb );
    req.end = function() {
	req2.end();
    };
    return req;
};


Keystone.prototype.forceDeleteEntity= function (type, id) {
    var req = new KeystoneAction(null, this);
    var req2 = this.deleteEntity(type, id)
	    .on('success', function(res){
		req._success_cb(res);
	    })
	    .on('error', function(res, xreq) {
		var odata = {};
		odata[this.keystone.entity_type[type]] = {enabled: false};
		this.keystone.updateEntity(type, id, odata )
		    .on('success', function(res){
			this.keystone.deleteEntity(type, id)
			    .on('success', function(res){
				req._success_cb(res);
			    })
			    .on('error', req._keystone_error_cb )
			    .end();
		    })
		    .on('error', req._keystone_error_cb )
		    .end();
	    } );
    req.end = function() {
	req2.end();
    };
    return req;
    return this.deleteEntity(type, id);
};

Keystone.prototype.actOnEntityByName = function(method, type, desired_entity, body) {
    var req = new KeystoneAction(null, this);
    var req2 = this.listEntities(type,  desired_entity)
	.on('success', function(res){
	    if( res[req2.type].length) {
		method.call(this.keystone, type, res[req2.type][0].id, body)
					   .on('success', req._success_cb )
					   .on('error', req._keystone_error_cb )
					   .end();
	    } else {
		if(req.notfoundnoerror) {
		    req._success_cb(null);
		    return;
		}
		req._keystone_error_cb({ error: 
					 { message: 'Could not find ' +this.keystone.entity_type[req2.type]+'.',
					   code: 004,
					   title: 'Not Found' } }, null);
	    }
	})
	.on('error', req._keystone_error_cb );
    req.end = function() {
	req2.end();
    };
    return req;
};

Keystone.prototype.actOnEntitiesByName = function(method, type, desired_entity, body) {
    var req = new KeystoneAction(null, this);
    var req2 = this.listEntities(type,  desired_entity)
	    .on('success', function(res){
		var k = this.keystone;
		if( res[req2.type].length) {
		    res[req2.type].map( function (val) {
			method.call(k, type, val.id, body)
		     	    .on('success', req._success_cb )
		     	    .on('error', req._keystone_error_cb )
		     	    .end();
		    });
		} else {
		    if(req.notfoundnoerror) {
			req._success_cb(null);
			return;
		    }
		    req._keystone_error_cb({ error: 
					     { message: 'Could not find ' +this.keystone.entity_type[req2.type]+'.',
					       code: 004,
					       title: 'Not Found' } }, null);
		}
	    })
	    .on('error', req._keystone_error_cb );
    req.end = function() {
	req2.end();
    };
    return req;
};

