var EnvisaLink = require('./envisalink.js');

module.exports = function (RED) {
  function EnvisaLinkInNode(config) {
    RED.nodes.createNode(this, config);
    var _this = this;
    this.controller = config.controller,
    this.controllerConn = RED.nodes.getNode(this.controller);

    if (this.controllerConn) {
      this.status({ fill: 'orange', shape: 'ring', text: 'Connecting...' });
      this.controllerConn.register(this);
    } else {
      this.error(RED._('Missing controller configuration'));
    }

    this.on('el-zoneupdate', function (update) {
      if (!update.initialUpdate) {
        delete update.initialUpdate;
        var msg = { topic: 'zone update', payload: update };
        _this.send(msg);
      }
    });

    this.on('el-partitionupdate', function (update) {
      if (!update.initialUpdate) {
        delete update.initialUpdate;
        var msg = { topic: 'partition update', payload: update };
        _this.send(msg);
      }
    });

    this.on('input', function (msg) {
      msg.payload = msg.payload.toLowerCase();
      _this.send(msg);
    });

    this.on('close', function (done) {
       if (_this.controllerConn) {
         _this.controllerConn.deregister(_this, done);
       }
     });
  }

  RED.nodes.registerType('envisalink in', EnvisaLinkInNode);

  function EnvisaLinkControllerNode(config) {
    RED.nodes.createNode(this, config);
    var _this = this;
    this.host = config.host;
    this.port = config.port;
    this.password = this.credentials.password;
    config.password = this.password;
    config.zones = config.zones;
    config.atomicEvents = false;
    config.partitions = config.partitions;
    this.connected = false;
    this.connecting = false;

    this.el = new EnvisaLink(config);

    this.users = {};

    this.register = function (elNode) {
      _this.users[elNode.id] = elNode;
      if (Object.keys(_this.users).length === 1) {
        if (!_this.connected && !_this.connecting) {
          _this.connecting = true;
          _this.el.connect();
        }
      }
    };

    this.deregister = function (elNode, done) {
      delete _this.users[elNode.id];
      if (_this.closing) {
        return done();
      }

      if (Object.keys(_this.users).length === 0) {
        _this.done = done;
        _this.el.disconnect();
      } else {
        done();
      }
    };

    this.el.on('connected', function () {
      for (var id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].status({ fill:'green', shape:'dot', text:'Connected' });
        }
      }
    });

    this.el.on('error', function (ex) {
      _this.log(RED._('Disconnected from ' + _this.host + ':' + _this.port));
      for (var id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].status({ fill:'red', shape:'ring', text:'Disconnected' });
        }
      }
    });

    this.el.on('log', function (log) {
      //node.log(RED._(log.text));
    });

    this.el.on('zoneupdate', function (update) {
      for (var id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].emit('el-zoneupdate', update);
        }
      }
    });

    this.el.on('partitionupdate', function (update) {
      for (var id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].emit('el-partitionupdate', update);
        }
      }
    });

    this.el.on('data', function (data) {
      //console.log("Data: ", data);
    });

    this.el.on('disconnect', function () {
      if (_this.done !== null) {
        _this.done();
        _this.done = null;
      }

      _this.log(RED._('Disconnected from ' + _this.host + ':' + _this.port));
      for (var id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].status({ fill:'red', shape:'ring', text:'Disconnected' });
        }
      }
    });



    //node.log(RED._("Connecting to " + this.host + ":" + this.port + " with pwd " + this.password,{"host": this.host}));

/*
    var alarm = nap.initConfig({ password:this.password,
    	serverpassword:"fnatt",
    	actualhost:this.host,
    	actualport:this.port,
    	serverhost:'0.0.0.0',
    	serverport:this.port,
    	zone:16,
    	partition:1,
    	proxyenable:false,
    	atomicEvents:true
    });
*/


    this.on('close', function (done) {
      _this.log(RED._("Closing Envisalink",{}));
      _this.closing = true;
      _this.connected = false;
      _this.connecting = false;
      _this.done = done;
      var wasDisconnected = _this.el.disconnect();
      if (wasDisconnected) {
        _this.done = null;
        done();
      }
    });
  }
  RED.nodes.registerType("envisalink-controller", EnvisaLinkControllerNode, {
    credentials: {
      password: {type: "password"}
    }
  });
}
