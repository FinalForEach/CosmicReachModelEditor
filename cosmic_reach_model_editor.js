(() => {
    let codec, import_action_block, dialog, propertiesDialog, originalJavaBlockCond, lastOccuranceOfSequenceInArray
    const resolveAssetPath = (modelPath, assetString) => {
        if (!assetString || typeof assetString !== 'string') return assetString;
        if (!modelPath || typeof modelPath !== 'string') return assetString.replace(":", "/");
        let patharr = modelPath.split(/[\\\/]/g)
        if (patharr.length > 0 && patharr[patharr.length - 1].endsWith(".json")) {
            patharr.pop()
        }
        let modelsIdx = patharr.lastIndexOf("models")
        if (modelsIdx !== -1) {
            if (assetString.includes(":")) {
                let baseDir = patharr.slice(0, modelsIdx - 1).join("/")
                return baseDir + "/" + assetString.replace(":", "/")
            } else {
                let baseDir = patharr.slice(0, modelsIdx).join("/")
                return baseDir + "/" + assetString
            }
        }
        return assetString.replace(":", "/")
    }
    const safeJSONParse = (jsonStr) => {
        if (typeof jsonStr !== 'string') return jsonStr;
        let cleanStr = jsonStr.replace(/("(?:[^\\"]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/.*/g, (match, group1) => group1 ? group1 : '');
        cleanStr = cleanStr.replace(/("(?:[^\\"]|\\.)*")|,\s*([}\]])/g, (match, group1, group2) => group1 ? group1 : group2);
        return JSON.parse(cleanStr);
    };
    const id = "cosmic_reach_model_editor"
    const name = "Cosmic Reach Model Editor"
    const icon = "icon.png"
    const icon64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAATxJREFUWIXtV6EOwjAQvREUAYFCowlBIkhm2LegMXwFho/gM8DMTS/T0ygEBDvE8pL1saNlWdIKnlmvaa+9d+/WNlqtd5WIyHgSSxPTUSJ94v66GPbzkYqIyKDXVTog2iTnqtnBkS/mM8OOl98dprlpF+XNsJkJ7wwM0UDkiBiRrrftE48n0z7s28dn19ofmCnKeh0w4Z8BqBEM2CIHbFoA2E9RirGefwbQQO55x8i1LeLsatrIOWsjzet1UB3hMKDBVRNdEQ4DrqrWNME514B5qIZwGABsqv9VE6gOMMR+vTPw38CHBljF2h+OgX7WBmx82V84DGgRMLQ6d60KZjAcBjRoOXedZ2MmHAZwPuMOh51rOWc1a+rn8XxL9s8Av4g451oOXcfxWQAEcyv+v4wi7XWM90Jf0Px7Z+ANxOF3G0qPE9EAAAAASUVORK5CYII="
    Plugin.register(id, {
      title: name,
      icon: "icon.png",
      author: "Z. Hoeshin",
      description: "Allows creating, editing, importing and exporting Cosmic Reach block models.",
      tags: ["Cosmic Reach"],
      version: "2.2.0",
      min_version: "5.0.0",
      creation_date: "2024-04-19",
      variant: "both",
      new_repository_format: true,
      has_changelog: true,
      onload() {
	originalJavaBlockCond = Codecs.java_block.load_filter.condition
        const blockPropertiesForm = {
            cullsSelf: {
                label: "Culls Self",
                type: "checkbox",
                value: true
            },
            isTransparent: {
                label: "Is transparent",
                type: "checkbox",
                value: false
            }
        }


        Codecs.java_block.load_filter.condition = (model) => {
			return !model.cuboids && !model.bones && originalJavaBlockCond(model);
		}

        dialog = new Dialog("cosmic_reach_model_errormessage", {
            id: "cosmic_reach_model_dialog_error",
            title: "Something went wrong...",
            buttons: [],
            lines: [],
        })

        propertiesDialog = new Dialog("cosmic_reach_model_properties_dialog", {
            id: "cosmic_reach_model_properties_dialog",
            title: "Properties",
            form: blockPropertiesForm,
            onConfirm: (b, e) => {
                let res = propertiesDialog.getFormResult()
                Project.properties = res
            },
            onCancel: (b, e) => {},
        })

        codec = new Codec("cosmic_reach_block_model_codec", {
            name: "Cosmic Reach",
            extension: "json",
            remember: false,
            load_filter: {type: "json", extensions: ["json"],
              condition: (model) => {
                  return Boolean(model.cuboids || (model.textures && !model.bones));
              }
            },
            format: new ModelFormat("cosmic_reach_model", {
                id: "cosmic_reach_model",
                icon: icon64,
                name: "Cosmic Reach Model",
                description: "Model format used by the game Cosmic Reach",
                show_on_start_screen: true,
                target: ["json"],
    
                vertex_color_ambient_occlusion: true,
                uv_rotation: true,
                java_face_properties: true,
                
                edit_mode: true,
    
                new() {
                    newProject(this)
                    Project.texture_width = 16
                    Project.texture_height = 16
                }
            }),
            compile(){
                let replacePostProcess = []

                let facenamesbb = ["up", "down", "north", "south", "east", "west"]
                let facenamescr = ["localPosY", "localNegY", "localNegZ", "localPosZ", "localPosX", "localNegX"]
            
                let cuboids = []
                let texturesUsed = []
                let textures = {}

                function compileCube(obj){
                    let uvs = {}
                    for(let f of Object.keys(obj.faces)){
                        let uv = obj.faces[f].uv
                        
                        let t = obj.faces[f].texture
                        let textures = Texture.all.filter((x) => {
                            if (x === undefined) {
                                return false
                            }
                            if (t instanceof Texture) {
                                return x.uuid == t.uuid
                            }
                            if (typeof(t) === 'string') {
                                return x.uuid == t
                            }
                        })
                        let texture = textures[0]
                        if (texture !== undefined) {
                            texture = texture.name
                        }
                        let face = obj.faces[f]

                        uvs[f] = [uv[0], uv[1], uv[2], uv[3], face.cullface, texture, face.rotation]

                        texturesUsed.push(texture)
                    }
                    
                    let cube = {
                        "localBounds": [...obj.from, ...obj.to],
                        "faces":{}
                    }
                    
                    for(let i = 0; i < 6; i++){
                        if ((uvs[facenamesbb[i]][5] === undefined) || (uvs[facenamesbb[i]][5] === "empty.png")){
                            continue
                        }
                        cube.faces[facenamescr[i]] = {
                            "uv": uvs[facenamesbb[i]].slice(0, 4),
                            "ambientocclusion": uvs[facenamesbb[i]][4].tint === 0,
                            "cullFace": uvs[facenamesbb[i]][4].length > 0,
                            "texture": uvs[facenamesbb[i]][5],
                            "uvRotation": uvs[facenamesbb[i]][6],
                        }
                    }

                    replacePostProcess.push(
                        cube.localBounds, 
                        cube.faces.localNegX,
                        cube.faces.localPosX,
                        cube.faces.localNegY,
                        cube.faces.localPosY,
                        cube.faces.localNegZ,
                        cube.faces.localPosZ,
                    )
                    
                    for(let f = 0; f < 6; f++){
                        if(uvs[facenamesbb[f]][4].rotation > 0){
                            cube.faces[facenamescr[f]].uvRotation = uvs[facenamesbb[f]][4].rotation
                        }
                    }

                    cuboids.push(cube)
                }
                let planes = []
                function compileMesh(mesh){
                    if (!mesh.faces) return;
                    for(let fKey in mesh.faces){
                        let face = mesh.faces[fKey];
                        if (!face || !face.vertices || face.vertices.length !== 4) continue;
                        let vertKeys = face.vertices;
                        let v0 = mesh.vertices[vertKeys[0]];
                        let v1 = mesh.vertices[vertKeys[1]];
                        let v2 = mesh.vertices[vertKeys[2]];
                        let v3 = mesh.vertices[vertKeys[3]];
                        if (!v0 || !v1 || !v2 || !v3) continue;

                        let texName = undefined;
                        if (face.texture) {
                            let matched = Texture.all.find(x => x.uuid === face.texture || x === face.texture);
                            if (matched) texName = matched.name;
                        }

                        let uv0 = (face.uv && face.uv[vertKeys[0]]) ? face.uv[vertKeys[0]] : [0, 0];
                        let uv1 = (face.uv && face.uv[vertKeys[1]]) ? face.uv[vertKeys[1]] : [16, 0];
                        let uv2 = (face.uv && face.uv[vertKeys[2]]) ? face.uv[vertKeys[2]] : [16, 16];
                        let uv3 = (face.uv && face.uv[vertKeys[3]]) ? face.uv[vertKeys[3]] : [0, 16];

                        let plane = {
                            "vertices": [
                                v0[0], v0[1], v0[2],
                                v1[0], v1[1], v1[2],
                                v2[0], v2[1], v2[2],
                                v3[0], v3[1], v3[2]
                            ],
                            "texture": texName || "top",
                            "uv": [uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1]],
                            "cullFace": Boolean(face.cullface),
                            "uvRotation": face.rotation || 0,
                            "doubleSided": true
                        };
                        planes.push(plane);
                        if (texName) texturesUsed.push(texName);
                    }
                }
                function compileGroup(group){
                    group.children.forEach(obj => {
					if (obj instanceof Group) {
						compileGroup(obj);
					} else if (obj instanceof Cube) {
						compileCube(obj)
					} else if (typeof Mesh !== 'undefined' && obj instanceof Mesh) {
						compileMesh(obj)
					}
				})
                }

                Outliner.root.forEach(obj => {
					if (obj instanceof Group) {
						compileGroup(obj);
					} else if (obj instanceof Cube) {
						compileCube(obj)
					} else if (typeof Mesh !== 'undefined' && obj instanceof Mesh) {
						compileMesh(obj)
					}
				})

                for(let i = 0; i < texturesUsed.length; i++){
                    if(texturesUsed[i] == null){
                        continue
                    }
                    const name = texturesUsed[i]
                    textures[name] = { "fileName": name }
                }
              
                let r = {"textures": textures, "cuboids": cuboids}
                if (planes.length > 0) {
                    r.planes = planes
                }
                if (Project.properties){
                    if (Project.properties.isTransparent !== undefined){
                        r.isTransparent = Project.properties.isTransparent
                    }
                    if (!Project.properties.cullsSelf !== undefined){
                        r.cullsSelf = Project.properties.cullsSelf
                    }
                }
                return stringifyJSON(r)
            },

            parse(rawJSONstring, path, cuboidsOnly = false){
                try {
                    console.log("[CosmicReachPlugin] Parsing Block Model from path:", path);
                    let loadedTextures = {}

                    let patharr = (path && typeof path === 'string') ? path.split(/[\\\/]/g) : []
                    if (patharr.length > 0) {
                        patharr = patharr.slice(0, patharr.length - 1)
                    }

                    let root = lastOccuranceOfSequenceInArray(patharr, ["models", "blocks"])

                let facenamesbb = ["up", "down", "north", "south", "east", "west"]
                let facenamescr = ["localPosY", "localNegY", "localNegZ", "localPosZ", "localPosX", "localNegX"]

                let allTexturesSpecified = false

                let data
                if(typeof rawJSONstring === 'string'){
                    data = safeJSONParse(rawJSONstring)
                }else if(rawJSONstring instanceof Object && !(rawJSONstring instanceof Array)){
                    data = rawJSONstring
                }else{
                    console.error("[CosmicReachPlugin] Unable to convert file data to Object");
                    throw "Unable to convert file data to Object"
                }

                console.log("[CosmicReachPlugin] Model Data:", data);

                if(cuboidsOnly === true){
                    if(data.cuboids === undefined){
                        if(data.parent === undefined){
                            return []
                        }else{
                            let p = data.parent
                            console.log("[CosmicReachPlugin] Reading parent model (cuboidsOnly):", p);
                            Blockbench.read(resolveAssetPath(path, p), {
                                extensions: ['json'],
                                type: 'Cosmic Reach Model',
                                readtype: 'text',
                                resource_id: 'json'
                            }, files => {
                                try{
                                    let cuboids = codec.parse(files[0].content, files[0].path, true);
                                    if(data.cuboids === undefined){
                                        data.cuboids = []
                                    }
                                    if(cuboids !== undefined){
                                        for(let c of cuboids){
                                            data.cuboids.push(c)
                                        }
                                    }
                                    return data.cuboids
                                }catch(error){
                                    console.error("[CosmicReachPlugin] Error parsing parent cuboids:", error);
                                    return []
                                }
                            })
                        }
                    }
                    return data.cuboids
                }

                if(data.textures === undefined){
                    data.textures = {}
                }

                for(let t of Object.keys(data.textures)){
                    let texVal = data.textures[t]
                    let texPath = typeof texVal === 'string' ? texVal : (texVal ? texVal.fileName : undefined)
                    if(texPath){
                        let resolved = resolveAssetPath(path, texPath);
                        console.log(`[CosmicReachPlugin] Loading texture '${t}':`, texPath, "=> resolved:", resolved);
                        let newtexture = new Texture().fromPath(resolved)
                        newtexture.name = texPath
                        loadedTextures[t] = newtexture.add()
                    }
                }
                
                if(Texture.all.length > 0) {
                    setTimeout(() => {
                        Project.texture_width = Texture.all[0].width
                        Project.texture_height = Texture.all[0].height
                    }, 50);
                }

                if(data.cuboids === undefined && data.planes === undefined){
                    if(data.parent === undefined){
                        console.error(`[CosmicReachPlugin] No cuboids or planes found in file ${path}`);
                        throw Error(`No cuboids or planes found in file ${path}`)
                    }else{
                        let p = data.parent
                        console.log("[CosmicReachPlugin] Loading parent model:", p);
                        Blockbench.read(resolveAssetPath(path, p), {
                            extensions: ['json'],
                            type: 'Cosmic Reach Model',
                            readtype: 'text',
                            resource_id: 'json'
                        }, files => {
                            try{
                                let cuboids = codec.parse(files[0].content, files[0].path, true);
                                if(data.cuboids === undefined){
                                    data.cuboids = []
                                }
                                if(cuboids !== undefined){
                                    for(let c of cuboids){
                                        data.cuboids.push(c)
                                    }
                                }
                                dialog.lines = `<div>
                                    <h1>Model is a child of '${p}'.</h1>
                                    <p>Loaded parent with textures from the model file</p>
                                </div>`.split("\n")
                                dialog.show()
                            }catch(error){
                                console.error("[CosmicReachPlugin] Unable to import parent of model:", error);
                                dialog.lines = `<div>
                                    <h1>Unable to import parent of the model.</h1>
                                    <p>${error}</p>
                                </div>`.split("\n")
                                dialog.show()
                            }
                        })
                    }
                }

                function getFaceUV(cuboid, face, uv){
                    return cuboid.faces[face].uv[uv]
                }

                function setUVforFace(cube, cuboid, facenamebb, facenamecr){
                    if(!cuboid.faces[facenamecr]) return;
                    let texKey = cuboid.faces[facenamecr].texture;
                    let textureObj = data.textures[texKey] || data.textures["all"];
                    let texPath = typeof textureObj === 'string' ? textureObj : (textureObj ? textureObj.fileName : undefined);

                    cube.faces[facenamebb].uv = [getFaceUV(cuboid, facenamecr, 0),
                                                getFaceUV(cuboid, facenamecr, 1),
                                                getFaceUV(cuboid, facenamecr, 2),
                                                getFaceUV(cuboid, facenamecr, 3)]
                    cube.faces[facenamebb].rotation = cuboid.faces[facenamecr]["uvRotation"] ?? 0
                    if(texPath){
                        let matched = Texture.all.filter((x) => { return x.name == texPath })[0]
                        if(matched){
                            cube.faces[facenamebb].texture = matched
                        }
                    }
                }

                console.log("[CosmicReachPlugin] Creating cuboids count:", data.cuboids?.length);
                if(data.cuboids){
                    for(let cuboid of data.cuboids){
                        let from = cuboid.localBounds.slice(0, 3)
                        let to = cuboid.localBounds.slice(3, 6)

                        console.log("[CosmicReachPlugin] Creating Cube from:", from, "to:", to);
                        let cube = new Cube({from: from, to: to})
                        for(let i = 0; i < 6; i++){
                            try{
                                setUVforFace(cube, cuboid, facenamesbb[i], facenamescr[i])
                            }catch(error){
                                console.warn(`[CosmicReachPlugin] Warning setting UV for face ${facenamesbb[i]}:`, error);
                            }
                            if(cuboid.faces[facenamescr[i]] !== undefined){
                                cube.faces[facenamesbb[i]].cullface = cuboid.faces[facenamescr[i]].cullFace ? facenamesbb[i] : ""
                                cube.faces[facenamesbb[i]].tint = cuboid.faces[facenamescr[i]].ambientocclusion ? 0 : -1
                            }else{
                                cube.faces[facenamesbb[i]].enabled = false
                            }
                        }
                        if(Group.all.length > 0){
                            cube.addTo(Group.all.last()).init()
                        }else{
                            cube.init()
                        }
                    }
                }
                
                if(data.planes && typeof Mesh !== 'undefined'){
                    console.log("[CosmicReachPlugin] Creating planes count:", data.planes.length);
                    for(let plane of data.planes){
                        if (!plane.vertices || plane.vertices.length < 12) continue;
                        let v = plane.vertices;
                        let uv = plane.uv || [0, 0, 16, 0, 16, 16, 0, 16];

                        let texKey = plane.texture || "top";
                        let textureObj = (data.textures && data.textures[texKey]) || (data.textures && data.textures["all"]) || (data.textures && Object.values(data.textures)[0]);
                        let texPath = typeof textureObj === 'string' ? textureObj : (textureObj ? textureObj.fileName : undefined);
                        let matchedTex = null;
                        if(texPath){
                            matchedTex = Texture.all.find((x) => { return x.name == texPath });
                        }

                        let mesh = new Mesh({
                            name: "plane",
                            vertices: {
                                v0: [v[0], v[1], v[2]],
                                v1: [v[3], v[4], v[5]],
                                v2: [v[6], v[7], v[8]],
                                v3: [v[9], v[10], v[11]]
                            },
                            faces: {
                                f0: {
                                    vertices: ["v0", "v1", "v2", "v3"],
                                    uv: {
                                        v0: [uv[0], uv[1]],
                                        v1: [uv[2], uv[3]],
                                        v2: [uv[4], uv[5]],
                                        v3: [uv[6], uv[7]]
                                    },
                                    texture: matchedTex
                                }
                            }
                        });
                        if(plane.cullFace){
                            mesh.faces.f0.cullface = "up";
                        }
                        if(Group.all.length > 0){
                            mesh.addTo(Group.all.last()).init();
                        }else{
                            mesh.init();
                        }
                    }
                }
                
                setTimeout(() => {
                    Canvas.updateAll()
                    console.log("[CosmicReachPlugin] Parsing complete. Canvas updated.");
                }, 50);

                properties = {isTransparent: false, cullsSelf: true}
                if (data.isTransparent !== undefined){
                    properties.isTransparent = data.isTransparent
                }
                if (data.cullsSelf !== undefined){
                    properties.cullsSelf = data.cullsSelf
                }
                Project.properties = properties

                return true;
                } catch(err) {
                    console.error("[CosmicReachPlugin] CRITICAL EXCEPTION IN BLOCK MODEL PARSE:", err, err?.stack);
                    throw err;
                }
            }
        })

        codec_animation = new Codec("cosmic_reach_entity_animation_codec", {
            name: "Cosmic Reach Entity Animation",
            extension: "json",
            remember: false,
            load_filter: {type: "json", extensions: ["json"],
              condition: (model) => {
                  return Boolean(model.animations);
              }
            },
            parse(rawJSONstring, path){
                let contents
                if(typeof rawJSONstring === 'string'){
                    contents = safeJSONParse(rawJSONstring)
                }else if(rawJSONstring instanceof Object && !(rawJSONstring instanceof Array)){
                    contents = rawJSONstring
                }else{
                    throw "Unable to convert file data to Object"
                }

                let bones = []
                function compileGroup(obj){
                    bones[obj.name] = {
                        self: obj,
                        parent: null
                    }
                    for(let child of obj.children){
                        if(child instanceof Group){
                            compileGroup(child)
                        }
                    }
                }
                Outliner.root.forEach(obj => {
					if (obj instanceof Group) {
						compileGroup(obj);
					} else if (obj instanceof Cube) {
					}
				})

                
                for(let animation_name of Object.keys(contents.animations)){
                    let animation = contents.animations[animation_name]
                    let animationobj = new Animation({
                        name: animation_name,
                        loop: animation.loop ? "loop" : "once",
                        length: animation.animation_length
                    })
                    for(let bone_name of Object.keys(animation.bones)){
                        let bone = animation.bones[bone_name]
                        if (!(bone_name in bones)) continue
                        let animator = animationobj.getBoneAnimator(bones[bone_name].self)
                        for(let channel_name of Object.keys(bone)){
                            let channel = bone[channel_name]
                            if(channel instanceof Array){
                                animator.addKeyframe({time: 0, channel: channel_name, data_points: [
                                    vectorFromArrayToObject(channel, true)
                                ]})
                            }else if(channel instanceof Object){
                                for(let timekey of Object.keys(channel)){
                                    let time = Number(timekey)
                                    let keyframedata = channel[timekey]
                                    
                                    if(Array.isArray(keyframedata)){
                                        animator.addKeyframe({time: time, channel: channel_name, interpolation: "linear", data_points: [
                                            vectorFromArrayToObject(keyframedata, true)
                                        ]})
                                    }else if(keyframedata instanceof Object){
                                        
                                        if(keyframedata.pre){
                                            animator.addKeyframe({time: time, channel: channel_name, interpolation: "bezier", data_points: [
                                                vectorFromArrayToObject(keyframedata.pre, true)
                                            ]})
                                        }
                                        if(keyframedata.post){
                                            animator.addKeyframe({time: time, channel: channel_name, interpolation: "bezier", data_points: [
                                                vectorFromArrayToObject(keyframedata.post, true)
                                            ]})
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    animationobj.add()
                }

            },

            compile(){
                let animations = {}
                for(let anim of Project.animations){
                    let animation = {
                        loop: anim.loop === "loop",
                        animation_length: anim.length
                    }
                    let bones = {}
                    for(let animatorEntry of Object.entries(anim.animators)){
                        let animator = animatorEntry[1]
                        let bone = {}
                        if(animator.position.length == 1){
                            if(animator.position[0].data_points.length == 1){
                                if(animator.position[0].time == 0){
                                    let data_point = animator.position[0].data_points[0]
                                    bone.position = [data_point.x, data_point.y, data_point.z].map((n) => Number(n))
                                }
                            }
                        }else if(animator.position.length > 0){
                            bone.position = {}
                            for(let keyframe of animator.position){
                                if(!keyframe.data_points.length) continue
                                if(keyframe.interpolation === "bezier"){
                                    bone.position[keyframe.time.toString()] = {
                                        "post": [keyframe.data_points[0].x, keyframe.data_points[0].y, keyframe.data_points[0].z].map((n) => Number(n)),
                                        "lerp_mode": "catmullrom"
                                    }
                                }else{
                                    bone.position[keyframe.time.toString()] = [keyframe.data_points[0].x, keyframe.data_points[0].y, keyframe.data_points[0].z].map((n) => Number(n))
                                }
                            }
                        }
                        if(animator.rotation.length == 1){
                            if(animator.rotation[0].data_points.length == 1){
                                if(animator.rotation[0].time == 0){
                                    let data_point = animator.rotation[0].data_points[0]
                                    bone.rotation = [data_point.x, data_point.y, data_point.z].map((n) => Number(n))
                                }
                            }
                        }else if(animator.rotation.length > 0){
                            bone.rotation = {}
                            for(let keyframe of animator.rotation){
                                if(!keyframe.data_points.length) continue
                                if(keyframe.interpolation === "bezier"){
                                    bone.rotation[keyframe.time.toString()] = {
                                        "post": [keyframe.data_points[0].x, keyframe.data_points[0].y, keyframe.data_points[0].z].map((n) => Number(n)),
                                        "lerp_mode": "catmullrom"
                                    }
                                }else{
                                    bone.rotation[keyframe.time.toString()] = [keyframe.data_points[0].x, keyframe.data_points[0].y, keyframe.data_points[0].z].map((n) => Number(n))
                                }
                            }
                        }
                        if(animator.scale.length == 1){
                            if(animator.scale[0].data_points.length == 1){
                                if(animator.scale[0].time == 0){
                                    let data_point = animator.scale[0].data_points[0]
                                    bone.scale = [data_point.x, data_point.y, data_point.z].map((n) => Number(n))
                                }
                            }
                        }else if(animator.scale.length > 0){
                            bone.scale = {}
                            for(let keyframe of animator.scale){
                                if(!keyframe.data_points.length) continue
                                if(keyframe.interpolation === "bezier"){
                                    bone.scale[keyframe.time.toString()] = {
                                        "post": [keyframe.data_points[0].x, keyframe.data_points[0].y, keyframe.data_points[0].z].map((n) => Number(n)),
                                        "lerp_mode": "catmullrom"
                                    }
                                }else{
                                    bone.scale[keyframe.time.toString()] = [keyframe.data_points[0].x, keyframe.data_points[0].y, keyframe.data_points[0].z].map((n) => Number(n))
                                }
                            }
                        }
                        if(bone.position){
                            bones[animator.group.name] = {position: bone.position}
                        }
                        if(bone.rotation){
                            if(bones[animator.group.name] === undefined){
                                bones[animator.group.name] = {}
                            }
                            if(bones[animator.group.name].rotation === undefined){
                                bones[animator.group.name].rotation = null
                            }
                            bones[animator.group.name].rotation = bone.rotation
                        }
                        if(bone.scale){
                            if(bones[animator.group.name] === undefined){
                                bones[animator.group.name] = {}
                            }
                            if(bones[animator.group.name].scale === undefined){
                                bones[animator.group.name].scale = null
                            }
                            bones[animator.group.name].scale = bone.scale
                        }
                    }
                    animation.bones = bones
                    animations[anim.name] = animation
                }
                return stringifyJSON({animations: animations})
            }
        })
        
        codec_entity = new Codec("cosmic_reach_entity_model_codec", {
            name: "Cosmic Reach Entity",
            extension: "json",
            remember: false,
            load_filter: {type: "json", extensions: ["json"],
            condition: (model) => {
                return Boolean(model.bones);
            }},
            format: new ModelFormat("cosmic_reach_entity_model", {
                id: "cosmic_reach_entity_model",
                icon: icon64,
                name: "Cosmic Reach Entity Model",
                description: "Entiy model format used by the game Cosmic Reach",
                show_on_start_screen: true,
                target: ["json"],
    
                vertex_color_ambient_occlusion: true,
                rotate_cubes: true,
                rotation_limit: false,
                rotation_snap: true,
                uv_rotation: false,
                box_uv: true,
                java_face_properties: true,
                centered_grid: true,
                edit_mode: true,
                rotate_cubes: true,
                box_uv: true,
                single_texture: true,
                bone_rig: true,
                centered_grid: true,
                animated_textures: true,
                animation_files: true,
                animation_mode: true,
                animation_controllers: true,
                bone_binding_expression: true,
                locators: true,
    
                new() {
                    newProject(this)
                }
            }),
            compile(){
                let bones = []
                
                function compileCube(obj){
                    let cube = {
                        origin: obj.from,
                        size: [obj.to[0] - obj.from[0], obj.to[1] - obj.from[1], obj.to[2] - obj.from[2]],
                        uv: obj.uv_offset
                    }
                    if(!vectorIsEqualToVector(obj.origin, [0, 0, 0])){
                        cube.pivot = obj.origin
                    }
                    if(!vectorIsEqualToVector(obj.rotation, [0, 0, 0])){
                        cube.rotation = obj.rotation
                    }
                    if(obj.inflate != 0){
                        cube.inflate = obj.inflate
                    }
                    return cube
                }
                function compileGroup(obj){
                    let newBone = {
                        name: obj.name,
                        pivot: obj.origin
                    }
                    if((obj.rotation[0] !== 0)||(obj.rotation[1] !== 0)||(obj.rotation[2] !== 0)){
                        newBone.rotation = obj.rotation
                    }

                    if(obj.parent != "root"){
                        newBone.parent = obj.parent.name
                    }
                    for(let child of obj.children){
                        if(child instanceof Group){
                            compileGroup(child)
                        }else if(child instanceof Cube){
                            if(newBone.cubes === undefined){
                                newBone.cubes = []
                            }
                            newBone.cubes.push(compileCube(child))
                        }
                    }
                    bones.push(newBone)
                }

                Outliner.root.forEach(obj => {
					if (obj instanceof Group) {
						compileGroup(obj);
					} else if (obj instanceof Cube) {
					}
				})
                
                let modelObj = {texture_width: Project.texture_width, texture_height: Project.texture_height, bones: bones}
                if (Project.name) {
                    modelObj.id = Project.name
                }
                return stringifyJSON(modelObj)
            },

            parse(rawJSONstring, path, _cuboidsOnly = false){
                try {
                    console.log("[CosmicReachPlugin] Parsing Entity Model from path:", path);
                let data
                if(typeof rawJSONstring === 'string'){
                    data = safeJSONParse(rawJSONstring)
                }else if(rawJSONstring instanceof Object && !(rawJSONstring instanceof Array)){
                    data = rawJSONstring
                }else{
                    console.error("[CosmicReachPlugin] Unable to convert entity model data to Object");
                    throw "Unable to convert file data to Object"
                }

                console.log("[CosmicReachPlugin] Entity Model Data:", data);

                Project.texture_width = data.texture_width || 16
                Project.texture_height = data.texture_height || 16

                Project.name = data.id || ""

                bones = {}
                for(let bone of data.bones){
                    let group = new Group({
                        name: bone.name,
                        origin: bone.pivot || [0, 0, 0],
                        rotation: bone.rotation
                    }).init()
                    if(bone.cubes){
                        for(let cube of bone.cubes){
                            let origin = cube.origin || [0, 0, 0]
                            let size = cube.size || [0, 0, 0]
                            let to = [origin[0] + size[0], origin[1] + size[1], origin[2] + size[2]]
                            console.log(`[CosmicReachPlugin] Entity Bone '${bone.name}' Cube origin:`, origin, "size:", size, "to:", to);
                            let newCube = new Cube({
                                uv_offset: cube.uv,
                                from: origin,
                                to: to,
                                rotation: cube.rotation,
                                origin: cube.pivot,
                                inflate: cube.inflate
                            })
                            newCube.addTo(group).init()
                        }
                    }
                    bones[bone.name] = {"self": group, "parent": bone.parent}
                }
                for(let bone of Object.keys(bones)){
                    let b = bones[bone]
                    if(b.parent){
                        b.self.addTo(bones[b.parent].self)
                    }else{
                        b.self.addTo("root")
                    }
                }

                let patharr = path.split(/[\\\/]/g)

                let loadedTextures = {}
                for(let t of Object.keys(data.textures ?? {})){
                    let texVal = data.textures[t]
                    let texPath = typeof texVal === 'string' ? texVal : (texVal ? texVal.fileName : undefined)
                    if(texPath){
                        let resolved = resolveAssetPath(path, texPath);
                        console.log(`[CosmicReachPlugin] Entity loading texture '${t}':`, texPath, "=> resolved:", resolved);
                        let newtexture = new Texture().fromPath(resolved)
                        newtexture.name = texPath
                        loadedTextures[t] = newtexture.add()
                    }
                }
                                
                let root = lastOccuranceOfSequenceInArray(patharr, ["models", "entities"])

                let animpatharr = [...patharr.slice(undefined, root - 1), "animations", ...patharr.slice(root)]
                animpatharr[animpatharr.length - 1] = animpatharr[animpatharr.length - 1].replace(/\.json$/gi, ".animation.json").replace(/^model_/gi, "")
                let animpath = animpatharr.join("/")
                fetch("file://" + animpath)
                    .then(res => res.ok ? res.text() : null)
                    .then(text => {
                        if (text) {
                            let contents = safeJSONParse(text)
                            codec_animation.parse(contents, animpath)
                        }
                    })
                    .catch(err => {
                        console.log("[CosmicReachPlugin] No animation file found at path:", animpath);
                    })

                } catch(err) {
                    console.error("[CosmicReachPlugin] CRITICAL EXCEPTION IN ENTITY MODEL PARSE:", err, err?.stack);
                    throw err;
                }
            }
        })
        
        import_action_block = new Action('import_cosmic_reach_model', {
            name: 'Import Cosmic Reach Block Model',
            description: '',
            icon: icon64,
            category: 'file',
            click() {
                Blockbench.import({
                    extensions: ['json'],
                    type: 'Cosmic Reach Model',
                    readtype: 'text',
                    resource_id: 'json'
                }, files => {
                    try{
                        codec.parse(files[0].content, files[0].path);
                        Canvas.updateAll()
                    }catch(error){
                        dialog.lines = `<div>
                            <h1>Unable to import file.</h1>
                            <p>${error}</p>
                        </div>`.split("\n")
                        dialog.show()
                    }
                })
            }
        })

        export_action_block = new Action('export_cosmic_reach_model', {
                    name: 'Export Cosmic Reach Block Model',
                    description: '',
                    icon: icon64,
                    category: 'file',
                    click() {
                        try{
                            codec.export({parent: undefined});
                        }catch(error){
                            dialog.lines = `<div>
                                <h1>Unable to export file.</h1>
                                <p>${error}</p>
                            </div>`.split("\n")
                            dialog.show()
                        }
                    }
                })
        export_action_block_aschild = new Action('export_cosmic_reach_model_aschild', {
                        name: 'Export Cosmic Reach Block Child Model',
                        description: '',
                        icon: icon64,
                        category: 'file',
                        click() {
                            try{
                                new Dialog("cosmic_reach_model_exportaschildmodeldialog", {
                                    id: "cosmic_reach_model_dialog_aschild",
                                    title: "Export model as a child",
                                    form: {
                                        name: {
                                            label: "Parent name",
                                            value: Project._name
                                        }
                                    },
                                    onConfirm: result => {
                                        codec.export({parent: result.name});
                                    }
                                }).show()
                            }catch(error){
                                dialog.lines = `<div>
                                    <h1>Unable to export file.</h1>
                                    <p>${error}</p>
                                </div>`.split("\n")
                                dialog.show()
                            }
                        }
                    })

        MenuBar.addAction(import_action_block, 'file.import')
        MenuBar.addAction(export_action_block, 'file.export')
        MenuBar.addAction(export_action_block_aschild, 'file.export')

        import_action_entity = new Action('import_cosmic_reach_entity_model', {
            name: 'Import Cosmic Reach Entity Model',
            description: '',
            icon: icon64,
            category: 'file',
            click() {
                Blockbench.import({
                    extensions: ['json'],
                    type: 'Cosmic Reach Model',
                    readtype: 'text',
                    resource_id: 'json'
                }, files => {
                    try{
                        codec_entity.parse(files[0].content, files[0].path);
                        Canvas.updateAll()
                    }catch(error){
                        dialog.lines = `<div>
                            <h1>Unable to import file.</h1>
                            <p>${error}</p>
                        </div>`.split("\n")
                        dialog.show()
                    }
                })
            }
        })
        export_action_entity = new Action('export_cosmic_reach_entity_model', {
            name: 'Export Cosmic Reach Entity Model',
            description: '',
            icon: icon64,
            click() {
                try{
                    codec_entity.export();
                }catch(error){
                    dialog.lines = `<div>
                        <h1>Unable to export file.</h1>
                        <p>${error}</p>
                    </div>`.split("\n")
                    dialog.show()
                }
            }
        })

        MenuBar.addAction(import_action_entity, 'file.import')
        MenuBar.addAction(export_action_entity, 'file.export')

        import_action_entity_animation = new Action('import_cosmic_reach_entity_animation', {
            name: 'Import Cosmic Reach Entity Animation',
            description: '',
            icon: icon64,
            category: 'file',
            click() {
                Blockbench.import({
                    extensions: ['json'],
                    type: 'Cosmic Reach Animation',
                    readtype: 'text',
                    resource_id: 'json'
                }, files => {
                    try{
                        codec_animation.parse(files[0].content, files[0].path);
                        Canvas.updateAll()
                    }catch(error){
                        dialog.lines = `<div>
                            <h1>Unable to import file.</h1>
                            <p>${error}</p>
                        </div>`.split("\n")
                        dialog.show()
                    }
                })
            }
        })
        export_action_entity_animation = new Action('export_cosmic_reach_entity_animation', {
            name: 'Export Cosmic Reach Entity Animation',
            description: '',
            icon: icon64,
            category: 'file',
            click() {
                try{
                    codec_animation.export();
                }catch(error){
                    dialog.lines = `<div>
                        <h1>Unable to export file.</h1>
                        <p>${error}</p>
                    </div>`.split("\n")
                    dialog.show()
                }
            }
        })

        show_properties_dialog = new Action("cosmic_reach_show_properties_dialog", {
            id: "cosmic_reach_show_properties_dialog",
            icon: icon64,
            description: "",
            name: "Edit model properties",
            category: "Tools",
            click() {
                if (Project && Project.format && Project.format.id === "cosmic_reach_model") {
                    propertiesDialog.show()
                    let values = Project.properties || { cullsSelf: true, isTransparent: false }
                    propertiesDialog.setFormValues(values)
                }
            }
        })

        
        MenuBar.addAction(import_action_entity_animation, 'file.import')
        MenuBar.addAction(export_action_entity_animation, 'file.export')

        MenuBar.addAction(show_properties_dialog, 'tools')

        lastOccuranceOfSequenceInArray = (array, sequence) => {
            let count = 0
            
            for(let i = array.length - 1; i >= 0; i--) {
                if(array[i] === sequence[sequence.length - count - 1]){
                    count ++
                    if(count === sequence.length - 1){
                        return i
                    }
                }
            }
            return -1
        }
        const vectorFromArrayToObject = (vectorArray, isString = false) => {
            return isString ? {x: vectorArray[0].toString(), y: vectorArray[1].toString(), z: vectorArray[2].toString()} : {x: vectorArray[0], y: vectorArray[1], z: vectorArray[2]}
        }

        const vectorIsEqualToVector = (vectorA, vectorB) => {
            return (vectorA[0] == vectorB[0]) && (vectorA[1] == vectorB[1]) && (vectorA[2] == vectorB[2])
        }

        function stringifyJSON(obj, exclude = [], space = "\t", excluder = (obj) => {
            if(Array.isArray(obj)){
                return obj.every(Number.isFinite)
            }else if(obj instanceof Object){
                return obj.uv !== undefined
            }
            return false
          }) {
            let recur = (obj, spacing, inarray, islastinarray = false) => {
              let txt = '';
          
              if (inarray) {
                if (Array.isArray(obj)) {        
                  txt += '[';
          
                  for(let i=0;i<obj.length;i++) {
                    var islast = i === (obj.length - 1)
                    
                    txt += recur(obj[i], spacing + space, true, islast);
                  };
          
                  txt = txt.substr(0, Math.max(1,txt.length - 2)) + ']';
                  
                } else if (typeof obj === 'object' && obj !== null) {
                    if(excluder(obj)){
                        txt += JSON.stringify(obj)
                    }else{
                        txt += '{' + recur(obj, spacing + space, false) + '\n' + spacing + '}';
                    }
                } else if (typeof obj === 'string') {
                  txt += obj.replaceAll(/\"/g, '\\"') + '"';
                } else {
                  txt += obj;
                };
                
                
                return txt + (islastinarray ? '  ' : ", ") + (excluder(obj) ? "\n" + spacing : "");
                
              } else {
                for (let key of Object.keys(obj)) {
                  if ((exclude.indexOf(key) !== -1)||(excluder(obj[key]))) {
                    txt += '\n' + spacing + '"' + key + '": ' + JSON.stringify(obj[key]);
                  } else if (Array.isArray(obj[key])) {
                    txt += '\n' + spacing + '"' + key + '": [';
                    
                    for(let i=0;i<obj[key].length;i++) {
                        var islast = i === (obj[key].length - 1)
                        
                      txt += recur(obj[key][i], spacing + space, true, islast);
                    };
                    
                    txt = txt.substr(0, Math.max(1,txt.length - 2)) + ']';
                    
                  } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    txt += '\n' + spacing + '"' + key + '": {' + recur(obj[key], spacing + space, false) + '\n' + spacing + '}';
                  } else if (typeof obj[key] === 'string') {
                    txt += '\n' + spacing + '"' + key + '": "' + obj[key].replaceAll(/\"/g, '\\"') + '"';
                  } else {
                    txt += '\n' + spacing + '"' + key + '": ' + obj[key];
                  };
                  
                  txt += ',';
                };
                
                return txt.substr(0, txt.length - 1);
              };
          
            };
            return (Array.isArray(obj) ? '[' + recur(obj, space, true) + '\n' + ']' : '{' + recur(obj, space, false) + '\n' + '}');
          };
      },


      onunload() {
		if (codec) codec.delete();
		if (import_action_block) import_action_block.delete();
		if (export_action_block) export_action_block.delete();
		if (export_action_block_aschild) export_action_block_aschild.delete();
		if (import_action_entity) import_action_entity.delete();
		if (export_action_entity) export_action_entity.delete();

        if (import_action_entity_animation) import_action_entity_animation.delete();
        if (export_action_entity_animation) export_action_entity_animation.delete();
        if (originalJavaBlockCond) Codecs.java_block.load_filter.condition = originalJavaBlockCond;

        if (show_properties_dialog) show_properties_dialog.delete();
      }
    })
  })()
