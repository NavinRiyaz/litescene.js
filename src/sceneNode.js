//****************************************************************************

/**
* The SceneNode class represents and object in the scene
* Is the base class for all objects in the scene as meshes, lights, cameras, and so
*
* @class SceneNode
* @param{String} id the id (otherwise a random one is computed)
* @constructor
*/

function SceneNode( name )
{
	//Generic
	this._name = name || ("node_" + (Math.random() * 10000).toFixed(0)); //generate random number
	this._uid = LS.generateUId("NODE-");
	this.init();
}

SceneNode.prototype.init = function( keep_components )
{
	this.layers = 3|0; //32 bits for layers (force to int)

	this._classList = {};
	//this.className = "";

	//flags
	this.flags = {
		visible: true,
		selectable: true,
		two_sided: false,
		flip_normals: false,
		cast_shadows: true,
		receive_shadows: true,
		ignore_lights: false, //not_affected_by_lights
		alpha_test: false,
		alpha_shadows: false,
		depth_test: true,
		depth_write: true
	};

	//Basic components
	if(!keep_components)
	{
		if( this._components && this._components.length )
			console.warn("SceneNode.init() should not be called if it contains components, call clear instead");
		this._components = []; //used for logic actions
		this.addComponent( new LS.Transform() );
	}

	//material
	this._material = null;
	this.extra = {}; //for extra info
}

//get methods from other classes
LS.extendClass( SceneNode, ComponentContainer ); //container methods
LS.extendClass( SceneNode, CompositePattern ); //container methods

/**
* changes the node name
* @method setName
* @param {String} new_name the new name
* @return {Object} returns true if the name changed
*/

Object.defineProperty( SceneNode.prototype, 'name', {
	set: function(name)
	{
		this.setName( name );
	},
	get: function(){
		return this._name;
	},
	enumerable: true
});

Object.defineProperty( SceneNode.prototype, 'uid', {
	set: function(uid)
	{
		if(!uid)
			return;

		if(uid[0] != LS._uid_prefix)
		{
			console.warn("Invalid UID, renaming it to: " + uid );
			uid = LS._uid_prefix + uid;
		}

		if(uid == this._uid)
			return;
		if( this._in_tree && this._in_tree._nodes_by_uid[ this.uid ] )
			delete this._in_tree._nodes_by_uid[ this.uid ];
		this._uid = uid;
		if( this._in_tree )
			this._in_tree._nodes_by_uid[ this.uid ] = this;
	},
	get: function(){
		return this._uid;
	},
	enumerable: true
});


Object.defineProperty( SceneNode.prototype, 'visible', {
	set: function(v)
	{
		this.flags.visible = v;
	},
	get: function(){
		return this.flags.visible;
	},
	enumerable: true
});

Object.defineProperty( SceneNode.prototype, 'material', {
	set: function(v)
	{
		this._material = v;
		if(!v)
			return;
		if(v.constructor === String)
			return;
		if(v._root && v._root != this)
			console.warn( "Cannot assign a material of one SceneNode to another, you must clone it or register it" )
		else
			v._root = this; //link
	},
	get: function(){
		return this._material;
	},
	enumerable: true
});

SceneNode.prototype.clear = function()
{
	this.removeAllComponents();
	this.removeAllChildren();
	this.init();
}

SceneNode.prototype.setName = function(new_name)
{
	if(this._name == new_name) 
		return true; //no changes

	//check that the name is valid (doesnt have invalid characters)
	if(!LS.validateName(new_name))
		return false;

	var scene = this._in_tree;
	if(!scene)
	{
		this._name = new_name;
		return true;
	}

	//remove old link
	if( this._name )
		delete scene._nodes_by_name[ this._name ];

	//assign name
	this._name = new_name;

	//we already have another node with this name
	if( new_name && !scene._nodes_by_name[ new_name ] )
		scene._nodes_by_name[ this._name ] = this;

	/**
	 * Node changed name
	 *
	 * @event name_changed
	 * @param {String} new_name
	 */
	LEvent.trigger( this, "name_changed", new_name );
	if(scene)
		LEvent.trigger( scene, "node_name_changed", this );
	return true;
}

Object.defineProperty( SceneNode.prototype, 'classList', {
	get: function() { return this._classList },
	set: function(v) {},
	enumerable: false
});

/**
* @property className {String}
*/
Object.defineProperty( SceneNode.prototype, 'className', {
	get: function() {
			var keys = null;
			if(Object.keys)
				keys = Object.keys(this._classList); 
			else
			{
				keys = [];
				for(var k in this._classList)
					keys.push(k);
			}
			return keys.join(" ");
		},
	set: function(v) { 
		this._classList = {};
		if(!v)
			return;
		var t = v.split(" ");
		for(var i in t)
			this._classList[ t[i] ] = true;
	},
	enumerable: true
});

SceneNode.prototype.getLocator = function()
{
	return this.uid;
}

SceneNode.prototype.getPropertyInfo = function( locator )
{
	var path = locator.split("/");
	return this.getPropertyInfoFromPath(path);
}

SceneNode.prototype.getPropertyInfoFromPath = function( path )
{
	var target = this;
	var varname = path[0];

	if(path.length == 0)
	{
		return {
			node: this,
			target: null,
			name: "",
			value: this,
			type: "node"
		};
	}
    else if(path.length == 1) //compo or //var
	{
		if(path[0][0] == "@")
		{
			target = this.getComponentByUId( path[0] );
			return {
				node: this,
				target: target,
				name: target ? LS.getObjectClassName( target ) : "",
				type: "component",
				value: target
			};
		}
		else if (path[0] == "material")
		{
			target = this.getMaterial();
			return {
				node: this,
				target: target,
				name: target ? LS.getObjectClassName( target ) : "",
				type: "material",
				value: target
			};
		}

		var target = this.getComponent( path[0] );
		if(target)
		{
			return {
				node: this,
				target: target,
				name: target ? LS.getObjectClassName( target ) : "",
				type: "component",
				value: target
			};
		}

		switch(path[0])
		{
			case "matrix":
			case "x": 
			case "y": 
			case "z": 
				target = this.transform;
				varname = path[0];
				break;
			default: 
				target = this;
				varname = path[0];
			break;
		}
	}
    else if(path.length > 1) //compo/var
	{
		if(path[0][0] == "@")
		{
			varname = path[1];
			target = this.getComponentByUId( path[0] );
		}
		else if (path[0] == "material")
		{
			target = this.getMaterial();
			varname = path[1];
		}
		else if (path[0] == "flags")
		{
			target = this.flags;
			varname = path[1];
		}
		else
		{
			target = this.getComponent( path[0] );
			varname = path[1];
		}

		if(!target)
			return null;
	}
	else //�?
	{
	}

	var v = undefined;

	if( target.getPropertyInfoFromPath && target != this )
	{
		var r = target.getPropertyInfoFromPath( path.slice(1) );
		if(r)
			return r;
	}

	if( target.getPropertyValue )
		v = target.getPropertyValue( varname );

	if(v === undefined && target[ varname ] === undefined)
		return null;

	var value = v !== undefined ? v : target[ varname ];

	var extra_info = target.constructor[ "@" + varname ];
	var type = "";
	if(extra_info)
		type = extra_info.type;
	if(!type && value !== null && value !== undefined)
	{
		if(value.constructor === String)
			type = "string";
		else if(value.constructor === Boolean)
			type = "boolean";
		else if(value.length)
			type = "vec" + value.length;
		else if(value.constructor === Number)
			type = "number";
	}

	return {
		node: this,
		target: target,
		name: varname,
		value: value,
		type: type
	};
}

SceneNode.prototype.setPropertyValue = function( locator, value )
{
	var path = locator.split("/");
	return this.setPropertyValueFromPath(path, value);
}

SceneNode.prototype.setPropertyValueFromPath = function( path, value )
{
	var target = null;
	var varname = path[0];

	if(path.length > 1)
	{
		if(path[0][0] == "@")
		{
			varname = path[1];
			target = this.getComponentByUId( path[0] );
		}
		else if( path[1] == "material" )
		{
			target = this.getMaterial();
			varname = path[1];
		}
		else if( path[1] == "flags" )
		{
			target = this.flags;
			varname = path[1];
		}
		else 
		{
			target = this.getComponent( path[0] );
			varname = path[1];
		}

		if(!target)
			return null;
	}
	else { //special cases 
		switch ( path[0] )
		{
			case "matrix": target = this.transform; break;
			case "x":
			case "translate.X": target = this.transform; varname = "x"; break;
			case "y":
			case "translate.Y": target = this.transform; varname = "y"; break;
			case "z":
			case "translate.Z": target = this.transform; varname = "z"; break;
			case "rotateX.ANGLE": target = this.transform; varname = "pitch"; break;
			case "rotateY.ANGLE": target = this.transform; varname = "yaw"; break;
			case "rotateZ.ANGLE": target = this.transform; varname = "roll"; break;
			default: target = this; //null
		}
	}

	if(!target)
		return null;

	if(target.setPropertyValueFromPath && target != this)
		if( target.setPropertyValueFromPath( path.slice(1), value ) === true )
			return target;
	
	if(target.setPropertyValue  && target != this)
		if( target.setPropertyValue( varname, value ) === true )
			return target;

	if( target[ varname ] === undefined )
		return;

	//disabled because if the vars has a setter it wont be called using the array.set
	//if( target[ varname ] !== null && target[ varname ].set )
	//	target[ varname ].set( value );
	//else
		target[ varname ] = value;

	return target;
}

SceneNode.prototype.getResources = function(res, include_children)
{
	//resources in components
	for(var i in this._components)
		if( this._components[i].getResources )
			this._components[i].getResources( res );

	//res in material
	if(this.material)
	{
		if(typeof(this.material) == "string")
		{
			if(this.material[0] != ":") //not a local material, then its a reference
			{
				res[this.material] = LS.Material;
			}
		}
		else //get the material to get the resources
		{
			var mat = this.getMaterial();
			if(mat)
				mat.getResources( res );
		}
	}

	//prefab
	if(this.prefab)
		res[ this.prefab ] = LS.Prefab;

	//propagate
	if(include_children)
		for(var i in this._children)
			this._children[i].getResources(res, true);

	return res;
}

SceneNode.prototype.getTransform = function() {
	return this.transform;
}

//Helpers

SceneNode.prototype.getMesh = function() {
	var mesh = this.mesh;
	if(!mesh && this.meshrenderer)
		mesh = this.meshrenderer.mesh;
	if(!mesh) return null;
	if(mesh.constructor === String)
		return ResourcesManager.meshes[mesh];
	return mesh;
}

//Light component
SceneNode.prototype.getLight = function() {
	return this.light;
}

//Camera component
SceneNode.prototype.getCamera = function() {
	return this.camera;
}

SceneNode.prototype.getLODMesh = function() {
	var mesh = this.lod_mesh;
	if(!mesh && this.meshrenderer)
		mesh = this.meshrenderer.lod_mesh;
	if(!mesh) return null;
	if(mesh.constructor === String)
		return ResourcesManager.meshes[mesh];
	return mesh;
}

SceneNode.prototype.setMesh = function(mesh_name, submesh_id)
{
	if(this.meshrenderer)
	{
		if(typeof(mesh_name) == "string")
			this.meshrenderer.configure({ mesh: mesh_name, submesh_id: submesh_id });
		else
			this.meshrenderer.mesh = mesh_name;
	}
	else
		this.addComponent( new LS.MeshRenderer({ mesh: mesh_name, submesh_id: submesh_id }) );
}

SceneNode.prototype.loadAndSetMesh = function(mesh_filename, options)
{
	options = options || {};

	if( LS.ResourcesManager.meshes[mesh_filename] || !mesh_filename )
	{
		this.setMesh( mesh_filename );
		if(options.on_complete) options.on_complete( LS.ResourcesManager.meshes[mesh_filename] ,this);
		return;
	}

	var that = this;
	var loaded = LS.ResourcesManager.load(mesh_filename, options, function(mesh){
		that.setMesh(mesh.filename);
		that.loading -= 1;
		if(that.loading == 0)
		{
			LEvent.trigger(that,"resource_loaded",that);
			delete that.loading;
		}
		if(options.on_complete)
			options.on_complete(mesh,that);
	});

	if(!loaded)
	{
		if(!this.loading)
		{
			this.loading = 1;

			LEvent.trigger(this,"resource_loading");
		}
		else
			this.loading += 1;
	}
}

SceneNode.prototype.getMaterial = function()
{
	if (!this.material)
		return null;
	if(this.material.constructor === String)
	{
		if( !this._in_tree )
			return null;
		if( this.material[0] == "@" )//uid
			return LS.ResourcesManager.materials_by_uid[ this.material ];
		return LS.ResourcesManager.materials[ this.material ];
	}
	return this.material;
}

SceneNode.prototype.reloadFromPrefab = function()
{
	if(!this.prefab)
		return;

	var prefab = LS.ResourcesManager.resources[ this.prefab ];
	if(!prefab)
		return;

	//apply info
	this.removeAllChildren();
	this.init( true );
	var data = LS.cloneObject( prefab.prefab_data );
	delete data.components;
	this.configure( data );
}


/**
* Assigns this node to one layer
* @method setLayer
* @param {number} num layer number
* @param {boolean} value 
*/
SceneNode.prototype.setLayer = function(num, value)
{
	var f = 1<<num;
	this.layers = (this.layers & (~f));
	if(value)
		this.layers |= f;
}

SceneNode.prototype.isInLayer = function(num)
{
	return (this.layers & (1<<num)) !== 0;
}

SceneNode.prototype.getLayers = function()
{
	var r = [];
	if(!this.scene)
		return r;

	for(var i = 0; i < 32; ++i)
	{
		if( this.layers & (1<<i) )
			r.push( this.scene.layer_names[i] || ("layer"+i) );
	}
	return r;
}

/**
* remember clones this node and returns the new copy (you need to add it to the scene to see it)
* @method clone
* @return {Object} returns a cloned version of this node
*/

SceneNode.prototype.clone = function()
{
	var scene = this._in_tree;

	var new_name = scene ? scene.generateUniqueNodeName( this._name ) : this._name ;
	var newnode = new LS.SceneNode( new_name );
	var info = this.serialize();

	//remove all uids from nodes and components
	LS.clearUIds( info );

	info.uid = LS.generateUId("NODE-");
	newnode.configure( info );

	return newnode;
}

/**
* Configure this node from an object containing the info
* @method configure
* @param {Object} info the object with all the info (comes from the serialize method)
*/
SceneNode.prototype.configure = function(info)
{
	//identifiers parsing
	if (info.name)
		this.setName(info.name);
	else if (info.id)
		this.setName(info.id);
	if(info.layers !== undefined)
		this.layers = info.layers;

	if (info.uid)
	{
		this.uid = info.uid;
	}
	if (info.className && info.className.constructor == String)	
		this.className = info.className;

	//TO DO: Change this to more generic stuff
	//some helpers (mostly for when loading from js object that come from importers
	if(info.mesh)
	{
		var mesh_id = info.mesh;
		var mesh = LS.ResourcesManager.meshes[ mesh_id ];

		if(mesh)
		{
			var mesh_render_config = { mesh: mesh_id };

			if(info.submesh_id !== undefined)
				mesh_render_config.submesh_id = info.submesh_id;
			if(info.morph_targets !== undefined)
				mesh_render_config.morph_targets = info.morph_targets;

			var compo = new LS.Components.MeshRenderer(mesh_render_config);

			//parsed meshes have info about primitive
			if( mesh.primitive === "line_strip" )
			{
				compo.primitive = 3;
				delete mesh.primitive;
			}

			//add MeshRenderer
			this.addComponent( compo );

			//skinning
			if(mesh && mesh.bones)
			{
				compo = new LS.Components.SkinDeformer();
				this.addComponent( compo );
			}

			//morph
			if( mesh && mesh.morph_targets )
			{
				var compo = new LS.Components.MorphDeformer( { morph_targets: mesh.morph_targets } );
				this.addComponent( compo );
			}
		}
		else
		{
			console.warn( "SceneNode mesh not found: " + mesh_id );
		}
	}

	//transform in matrix format could come from importers so we leave it
	if(info.model) 
		this.transform.fromMatrix( info.model ); 

	//first the no components
	if(info.material)
	{
		var mat_class = info.material.material_class;
		if(!mat_class) 
			mat_class = "Material";
		this.material = typeof(info.material) == "string" ? info.material : new LS.MaterialClasses[mat_class](info.material);
	}

	if(info.flags) //merge
		for(var i in info.flags)
			this.flags[i] = info.flags[i];
	
	if(info.prefab) 
		this.prefab = info.prefab;

	//add animation tracks player
	if(info.animations)
	{
		this.animations = info.animations;
		this.addComponent( new LS.Components.PlayAnimation({animation:this.animations}) );
	}

	//extra user info
	if(info.extra)
		this.extra = info.extra;

	if(info.comments)
		this.comments = info.comments;

	//restore components
	if(info.components)
		this.configureComponents(info);

	//configure children too
	this.configureChildren(info);

	LEvent.trigger(this,"configure",info);
}

/**
* Serializes this node by creating an object with all the info
* it contains info about the components too
* @method serialize
* @return {Object} returns the object with the info
*/
SceneNode.prototype.serialize = function()
{
	var o = {};

	if(this._name) 
		o.name = this._name;
	if(this.uid) 
		o.uid = this.uid;
	if(this.className) 
		o.className = this.className;
	o.layers = this.layers;

	//modules
	if(this.mesh && typeof(this.mesh) == "string") 
		o.mesh = this.mesh; //do not save procedural meshes
	if(this.submesh_id != null) 
		o.submesh_id = this.submesh_id;
	if(this.material) 
		o.material = typeof(this.material) == "string" ? this.material : this.material.serialize();
	if(this.prefab) 
		o.prefab = this.prefab;

	if(this.flags) 
		o.flags = LS.cloneObject(this.flags);

	//extra user info
	if(this.extra) 
		o.extra = this.extra;
	if(this.comments) 
		o.comments = this.comments;

	if(this._children)
		o.children = this.serializeChildren();

	//save components
	this.serializeComponents(o);

	//extra serializing info
	LEvent.trigger(this,"serialize",o);

	return o;
}

//used to recompute matrix so when parenting one node it doesnt lose its global transformation
SceneNode.prototype._onChildAdded = function( child_node, recompute_transform )
{
	if(recompute_transform && this.transform)
	{
		var M = child_node.transform.getGlobalMatrix(); //get son transform
		var M_parent = this.transform.getGlobalMatrix(); //parent transform
		mat4.invert(M_parent,M_parent);
		child_node.transform.fromMatrix( mat4.multiply(M_parent,M_parent,M) );
		child_node.transform.getGlobalMatrix(); //refresh
	}
	//link transform
	if(this.transform)
		child_node.transform._parent = this.transform;
}

SceneNode.prototype._onChangeParent = function( future_parent, recompute_transform )
{
	if(recompute_transform && future_parent.transform)
	{
		var M = this.transform.getGlobalMatrix(); //get son transform
		var M_parent = future_parent.transform.getGlobalMatrix(); //parent transform
		mat4.invert(M_parent,M_parent);
		this.transform.fromMatrix( mat4.multiply(M_parent,M_parent,M) );
	}
	//link transform
	if(future_parent.transform)
		this.transform._parent = future_parent.transform;
}

SceneNode.prototype._onChildRemoved = function( node, recompute_transform, remove_components )
{
	if(this.transform)
	{
		//unlink transform
		if(recompute_transform)
		{
			var m = node.transform.getGlobalMatrix();
			node.transform._parent = null;
			node.transform.fromMatrix(m);
		}
		else
			node.transform._parent = null;
	}

	if( remove_components )
		node.removeAllComponents();
}

//Computes the bounding box from the render instance of this node
//doesnt take into account children
SceneNode.prototype.getBoundingBox = function( bbox, only_instances )
{
	bbox = bbox || BBox.create();
	var render_instances = this._instances;
	if(render_instances)
		for(var i = 0; i < render_instances.length; ++i)
		{
			if(i == 0)
				bbox.set( render_instances[i].aabb );
			else
				BBox.merge( bbox, bbox, render_instances[i].aabb );
		}

	if(only_instances)
		return bbox;

	if( (!render_instances || render_instances.length == 0) && this.transform )
		return BBox.fromPoint( this.transform.getGlobalPosition() );

	return bbox;
}

LS.SceneNode = SceneNode;
LS.Classes.SceneNode = SceneNode;