goog.provide('renderCtx2D');

/**
 * @constructor
 * @param {CanvasRenderingContext2D} ctx
 */
renderCtx2D = function (ctx)
{
	var render = this;
	render.ctx = ctx;
	render.images = {};
	render.skin_info_map = {};
	render.region_vertex_position = new Float32Array([ -1, -1, 1, -1, 1, 1, -1, 1 ]);
	render.region_vertex_texcoord = new Float32Array([ 0, 1, 1, 1, 1, 0, 0, 0 ]);
	render.region_vertex_triangle = new Uint16Array([ 0, 1, 2, 0, 2, 3 ]);
}

/**
 * @return {void}
 * @param {spine.Pose} pose
 * @param {spine.Atlas} atlas
 */
renderCtx2D.prototype.dropPose = function (pose, atlas)
{
	var render = this;

	for (var image_key in render.images)
	{
		delete render.images[image_key];
	}

	render.images = {};
	render.skin_info_map = {};
}

/**
 * @return {void}
 * @param {spine.Pose} pose
 * @param {spine.Atlas} atlas
 * @param {string} file_path
 * @param {string} file_atlas_url
 */
renderCtx2D.prototype.loadPose = function (pose, atlas, file_path, file_atlas_url)
{
	var render = this;

	pose.data.iterateSkins(function (skin_key, skin)
	{
		var skin_info = render.skin_info_map[skin_key] = {};
		var slot_info_map = skin_info.slot_info_map = {};

		pose.data.iterateAttachments(skin_key, function (slot_key, slot, skin_slot, attachment_key, attachment)
		{
			if (!attachment) { return; }

			switch (attachment.type)
			{
			case 'mesh':
				var slot_info = slot_info_map[slot_key] = {};
				slot_info.type = attachment.type;
				var vertex_count = slot_info.vertex_count = attachment.vertices.length / 2;
				var vertex_position = slot_info.vertex_position = new Float32Array(attachment.vertices);
				var vertex_texcoord = slot_info.vertex_texcoord = new Float32Array(attachment.uvs);
				var vertex_triangle = slot_info.vertex_triangle = new Uint16Array(attachment.triangles);
				var anim_ffd_attachments = slot_info.anim_ffd_attachments = {};
				pose.data.iterateAnims(function (anim_key, anim)
				{
					var anim_ffd = anim.ffds && anim.ffds[skin_key];
					var ffd_slot = anim_ffd && anim_ffd.ffd_slots[slot_key];
					var ffd_attachment = ffd_slot && ffd_slot.ffd_attachments[attachment_key];
					if (ffd_attachment)
					{
						var anim_ffd_attachment = anim_ffd_attachments[anim_key] = {};
						var anim_ffd_keyframes = anim_ffd_attachment.ffd_keyframes = [];
						ffd_attachment.ffd_keyframes.forEach(function (ffd_keyframe, ffd_keyframe_index)
						{
							var anim_ffd_keyframe = anim_ffd_keyframes[ffd_keyframe_index] = {};
							var vertex = anim_ffd_keyframe.vertex = new Float32Array(2 * vertex_count);
							vertex.subarray(ffd_keyframe.offset, ffd_keyframe.offset + ffd_keyframe.vertices.length).set(new Float32Array(ffd_keyframe.vertices));
						});
					}
				});
				break;
			case 'skinnedmesh':
				var slot_info = slot_info_map[slot_key] = {};
				slot_info.type = attachment.type;
				var vertex_count = slot_info.vertex_count = attachment.uvs.length / 2;
				var vertex_setup_position = slot_info.vertex_setup_position = new Float32Array(2 * vertex_count);
				var vertex_blend_position = slot_info.vertex_blend_position = new Float32Array(2 * vertex_count);
				var vertex_texcoord = slot_info.vertex_texcoord = new Float32Array(attachment.uvs);
				var vertex_triangle = slot_info.vertex_triangle = new Uint16Array(attachment.triangles);
				var position = new spine.Vector();
				for (var vertex_index = 0, i = 0; vertex_index < vertex_count; ++vertex_index)
				{
					var blender_count = attachment.vertices[i++];
					var setup_position_x = 0;
					var setup_position_y = 0;
					for (var blender_index = 0; blender_index < blender_count; ++blender_index)
					{
						var bone_index = attachment.vertices[i++];
						var x = position.x = attachment.vertices[i++];
						var y = position.y = attachment.vertices[i++];
						var weight = attachment.vertices[i++];
						var bone_key = pose.data.bone_keys[bone_index];
						var bone = pose.data.bones[bone_key];
						spine.Space.transform(bone.world_space, position, position);
						setup_position_x += position.x * weight;
						setup_position_y += position.y * weight;
					}
					var vertex_setup_position_offset = vertex_index * 2;
					vertex_setup_position[vertex_setup_position_offset++] = setup_position_x;
					vertex_setup_position[vertex_setup_position_offset++] = setup_position_y;
				}
				vertex_blend_position.set(vertex_setup_position);
				break;
			}
		});
	});

	if (atlas)
	{
		// load atlas page images
		var dir_path = file_atlas_url.slice(0, file_atlas_url.lastIndexOf('/'));
		atlas.pages.forEach(function (page)
		{
			var image_key = page.name;
			var image_url = dir_path + "/" + image_key;
			render.images[image_key] = render.images[image_key] || loadImage(image_url, (function (page) { return function (err, image)
			{
				if (err)
				{
					console.log("error loading:", image.src);
				}
				page.w = page.w || image.width;
				page.h = page.h || image.height;
			}})(page));
		});
	}
	else
	{
		// load attachment images
		pose.data.iterateSkins(function (skin_key, skin)
		{
			pose.data.iterateAttachments(skin_key, function (slot_key, slot, skin_slot, attachment_key, attachment)
			{
				if (!attachment) { return; }

				switch (attachment.type)
				{
				case 'region':
				case 'mesh':
				case 'skinnedmesh':
					var image_key = attachment_key;
					var image_url = file_path + pose.data.skeleton.images + image_key + ".png";
					render.images[image_key] = render.images[image_key] || loadImage(image_url, function (err, image)
					{
						if (err)
						{
							console.log("error loading:", image.src);
						}
					});
					break;
				}
			});
		});
	}
}

/**
 * @return {void}
 * @param {spine.Pose} pose
 * @param {spine.Atlas} atlas
 */
renderCtx2D.prototype.updatePose = function (pose, atlas)
{
	var render = this;

	pose.iterateAttachments(function (slot_key, slot, skin_slot, attachment_key, attachment)
	{
		if (!attachment) { return; }
		switch (attachment.type)
		{
		case 'mesh':
			var slot_info = render.skin_info_map[pose.skin_key].slot_info_map[slot_key];
			var anim = pose.data.anims[pose.anim_key];
			var anim_ffd = anim && anim.ffds && anim.ffds[pose.skin_key];
			var ffd_slot = anim_ffd && anim_ffd.ffd_slots[slot_key];
			var ffd_attachment = ffd_slot && ffd_slot.ffd_attachments[attachment_key];
			var ffd_keyframes = ffd_attachment && ffd_attachment.ffd_keyframes;
			var ffd_keyframe_index = spine.Keyframe.find(ffd_keyframes, pose.time);
			if (ffd_keyframe_index !== -1)
			{
				var ffd_keyframe0 = ffd_keyframes[ffd_keyframe_index];
				var ffd_keyframe1 = ffd_keyframes[ffd_keyframe_index + 1];
				if (ffd_keyframe1)
				{
					var pct = ffd_keyframe0.curve.evaluate((pose.time - ffd_keyframe0.time) / (ffd_keyframe1.time - ffd_keyframe0.time));
					for (var i = 0; i < slot_info.vertex_position.length; ++i)
					{
						var v0 = ffd_keyframe0.vertices[i - ffd_keyframe0.offset] || 0;
						var v1 = ffd_keyframe1.vertices[i - ffd_keyframe1.offset] || 0;
						slot_info.vertex_position[i] = attachment.vertices[i] + spine.tween(v0, v1, pct);
					}
				}
				else
				{
					for (var i = 0; i < slot_info.vertex_position.length; ++i)
					{
						var v0 = ffd_keyframe0.vertices[i - ffd_keyframe0.offset] || 0;
						slot_info.vertex_position[i] = attachment.vertices[i] + v0;
					}
				}
			}
			break;
		case 'skinnedmesh':
			var slot_info = render.skin_info_map[pose.skin_key].slot_info_map[slot_key];
			var anim = pose.data.anims[pose.anim_key];
			var anim_ffd = anim && anim.ffds && anim.ffds[pose.skin_key];
			var ffd_slot = anim_ffd && anim_ffd.ffd_slots[slot_key];
			var ffd_attachment = ffd_slot && ffd_slot.ffd_attachments[attachment_key];
			var ffd_keyframes = ffd_attachment && ffd_attachment.ffd_keyframes;
			var ffd_keyframe_index = spine.Keyframe.find(ffd_keyframes, pose.time);
			if (ffd_keyframe_index !== -1)
			{
				var ffd_keyframe0 = ffd_keyframes[ffd_keyframe_index];
				var ffd_keyframe1 = ffd_keyframes[ffd_keyframe_index + 1];
				if (ffd_keyframe1)
				{
					// ffd with tweening

					var pct = ffd_keyframe0.curve.evaluate((pose.time - ffd_keyframe0.time) / (ffd_keyframe1.time - ffd_keyframe0.time));

					var vertex_blend_position = slot_info.vertex_blend_position;
					var position = new spine.Vector();
					for (var vertex_index = 0, i = 0, ffd_index = 0; vertex_index < slot_info.vertex_count; ++vertex_index)
					{
						var blender_count = attachment.vertices[i++];
						var blend_position_x = 0;
						var blend_position_y = 0;
						for (var blender_index = 0; blender_index < blender_count; ++blender_index)
						{
							var bone_index = attachment.vertices[i++];
							position.x = attachment.vertices[i++];
							position.y = attachment.vertices[i++];
							var weight = attachment.vertices[i++];
							var bone_key = pose.bone_keys[bone_index];
							var bone = pose.bones[bone_key];
							var v0 = ffd_keyframe0.vertices[ffd_index - ffd_keyframe0.offset] || 0;
							var v1 = ffd_keyframe1.vertices[ffd_index - ffd_keyframe1.offset] || 0;
							position.x += spine.tween(v0, v1, pct); ++ffd_index;
							var v0 = ffd_keyframe0.vertices[ffd_index - ffd_keyframe0.offset] || 0;
							var v1 = ffd_keyframe1.vertices[ffd_index - ffd_keyframe1.offset] || 0;
							position.y += spine.tween(v0, v1, pct); ++ffd_index;
							spine.Space.transform(bone.world_space, position, position);
							blend_position_x += position.x * weight;
							blend_position_y += position.y * weight;
						}
						var vertex_position_offset = vertex_index * 2;
						vertex_blend_position[vertex_position_offset++] = blend_position_x;
						vertex_blend_position[vertex_position_offset++] = blend_position_y;
					}
				}
				else
				{
					// ffd with no tweening

					var vertex_blend_position = slot_info.vertex_blend_position;
					var position = new spine.Vector();
					for (var vertex_index = 0, i = 0, ffd_index = 0; vertex_index < slot_info.vertex_count; ++vertex_index)
					{
						var blender_count = attachment.vertices[i++];
						var blend_position_x = 0;
						var blend_position_y = 0;
						for (var blender_index = 0; blender_index < blender_count; ++blender_index)
						{
							var bone_index = attachment.vertices[i++];
							position.x = attachment.vertices[i++];
							position.y = attachment.vertices[i++];
							var weight = attachment.vertices[i++];
							var bone_key = pose.bone_keys[bone_index];
							var bone = pose.bones[bone_key];
							position.x += ffd_keyframe0.vertices[ffd_index - ffd_keyframe0.offset] || 0; ++ffd_index;
							position.y += ffd_keyframe0.vertices[ffd_index - ffd_keyframe0.offset] || 0; ++ffd_index;
							spine.Space.transform(bone.world_space, position, position);
							blend_position_x += position.x * weight;
							blend_position_y += position.y * weight;
						}
						var vertex_position_offset = vertex_index * 2;
						vertex_blend_position[vertex_position_offset++] = blend_position_x;
						vertex_blend_position[vertex_position_offset++] = blend_position_y;
					}
				}
			}
			else
			{
				// no ffd

				var vertex_blend_position = slot_info.vertex_blend_position;
				var position = new spine.Vector();
				for (var vertex_index = 0, i = 0; vertex_index < slot_info.vertex_count; ++vertex_index)
				{
					var blender_count = attachment.vertices[i++];
					var blend_position_x = 0;
					var blend_position_y = 0;
					for (var blender_index = 0; blender_index < blender_count; ++blender_index)
					{
						var bone_index = attachment.vertices[i++];
						position.x = attachment.vertices[i++];
						position.y = attachment.vertices[i++];
						var weight = attachment.vertices[i++];
						var bone_key = pose.bone_keys[bone_index];
						var bone = pose.bones[bone_key];
						spine.Space.transform(bone.world_space, position, position);
						blend_position_x += position.x * weight;
						blend_position_y += position.y * weight;
					}
					var vertex_position_offset = vertex_index * 2;
					vertex_blend_position[vertex_position_offset++] = blend_position_x;
					vertex_blend_position[vertex_position_offset++] = blend_position_y;
				}
			}
			break;
		}
	});
}

/**
 * @return {void}
 * @param {spine.Pose} pose
 * @param {spine.Atlas} atlas
 */
renderCtx2D.prototype.drawPose = function (pose, atlas)
{
	var render = this;
	var ctx = render.ctx;

	render.updatePose(pose, atlas);

	pose.iterateAttachments(function (slot_key, slot, skin_slot, attachment_key, attachment)
	{
		if (!attachment) { return; }
		if (attachment.type === 'boundingbox') { return; }

		var image = null;
		var site = atlas && atlas.sites[attachment_key];
		if (site)
		{
			var page = atlas.pages[site.page];
			var image_key = page.name;
			image = render.images[image_key];
		}
		else
		{
			var image_key = attachment_key;
			image = render.images[image_key];
		}

		if (image && image.complete)
		{
			ctx.save();

			switch (slot.blend)
			{
			default:
			case 'normal': ctx.globalCompositeOperation = 'source-over'; break;
			case 'additive': ctx.globalCompositeOperation = 'lighter'; break;
			case 'multiply': ctx.globalCompositeOperation = 'multiply'; break;
			case 'screen': ctx.globalCompositeOperation = 'screen'; break;
			}

			switch (attachment.type)
			{
			case 'region':
				applySpace(ctx, attachment.world_space);
				ctx.scale(attachment.width/2, attachment.height/2);
				drawImageMesh(ctx, render.region_vertex_triangle, render.region_vertex_position, render.region_vertex_texcoord, image, site);
				break;
			case 'mesh':
				var slot_info = render.skin_info_map[pose.skin_key].slot_info_map[slot_key];
				var bone = pose.bones[slot.bone_key];
				applySpace(ctx, bone.world_space);
				drawImageMesh(ctx, slot_info.vertex_triangle, slot_info.vertex_position, slot_info.vertex_texcoord, image, site);
				break;
			case 'skinnedmesh':
				var slot_info = render.skin_info_map[pose.skin_key].slot_info_map[slot_key];
				drawImageMesh(ctx, slot_info.vertex_triangle, slot_info.vertex_blend_position, slot_info.vertex_texcoord, image, site);
				break;
			}

			ctx.restore();
		}
	});
}

/**
 * @return {void}
 * @param {spine.Pose} pose
 * @param {spine.Atlas} atlas
 */
renderCtx2D.prototype.drawDebugPose = function (pose, atlas)
{
	var render = this;
	var ctx = render.ctx;
	
	render.updatePose(pose, atlas);

	pose.iterateAttachments(function (slot_key, slot, skin_slot, attachment_key, attachment)
	{
		if (!attachment) { return; }

		ctx.save();

		switch (attachment.type)
		{
		case 'region':
			applySpace(ctx, attachment.world_space);
			var w = attachment.width;
			var h = attachment.height;
			ctx.fillStyle = 'rgba(127,127,127,0.25)';
			ctx.fillRect(-w/2, -h/2, w, h);
			ctx.strokeStyle = 'rgba(127,127,127,1.0)';
			ctx.strokeRect(-w/2, -h/2, w, h);
			break;
		case 'boundingbox':
			var bone = pose.bones[slot.bone_key];
			applySpace(ctx, bone.world_space);
			ctx.beginPath();
			var x = 0;
			attachment.vertices.forEach(function (value, index)
			{
				if (index & 1) { ctx.lineTo(x, value); } else { x = value; }
			});
			ctx.closePath();
			ctx.strokeStyle = 'rgba(127,127,127,1.0)';
			ctx.stroke();
			break;
		case 'mesh':
			var slot_info = render.skin_info_map[pose.skin_key].slot_info_map[slot_key];
			var bone = pose.bones[slot.bone_key];
			applySpace(ctx, bone.world_space);
			drawMesh(ctx, slot_info.vertex_triangle, slot_info.vertex_position, 'rgba(127,127,127,1.0)', 'rgba(127,127,127,0.25)');
			break;
		case 'skinnedmesh':
			var slot_info = render.skin_info_map[pose.skin_key].slot_info_map[slot_key];
			drawMesh(ctx, slot_info.vertex_triangle, slot_info.vertex_blend_position, 'rgba(127,127,127,1.0)', 'rgba(127,127,127,0.25)');
			break;
		}

		ctx.restore();
	});

	pose.iterateBones(function (bone_key, bone)
	{
		ctx.save();
		applySpace(ctx, bone.world_space);
		drawPoint(ctx);
		ctx.restore();
	});

	drawIkConstraints(ctx, pose.data, pose.bones);
}

/**
 * @return {void}
 * @param {spine.Pose} pose
 * @param {spine.Atlas} atlas
 */
renderCtx2D.prototype.drawDebugData = function (pose, atlas)
{
	var render = this;
	var ctx = render.ctx;

	pose.data.iterateAttachments(pose.skin_key, function (slot_key, slot, skin_slot, attachment_key, attachment)
	{
		if (!attachment) { return; }

		ctx.save();

		switch (attachment.type)
		{
		case 'region':
			var bone = pose.data.bones[slot.bone_key];
			applySpace(ctx, bone.world_space);
			applySpace(ctx, attachment.local_space);
			var w = attachment.width;
			var h = attachment.height;
			ctx.fillStyle = 'rgba(127,127,127,0.25)';
			ctx.fillRect(-w/2, -h/2, w, h);
			ctx.strokeStyle = 'rgba(127,127,127,1.0)';
			ctx.strokeRect(-w/2, -h/2, w, h);
			break;
		case 'boundingbox':
			var bone = pose.data.bones[slot.bone_key];
			applySpace(ctx, bone.world_space);
			ctx.beginPath();
			var x = 0;
			attachment.vertices.forEach(function (value, index)
			{
				if (index & 1) { ctx.lineTo(x, value); } else { x = value; }
			});
			ctx.closePath();
			ctx.strokeStyle = 'rgba(127,127,127,1.0)';
			ctx.stroke();
			break;
		case 'mesh':
			var skin_info = render.skin_info_map[pose.skin_key];
			var slot_info_map = skin_info.slot_info_map;
			var slot_info = slot_info_map[slot_key];
			var bone = pose.data.bones[slot.bone_key];
			applySpace(ctx, bone.world_space);
			drawMesh(ctx, slot_info.vertex_triangle, slot_info.vertex_position, 'rgba(127,127,127,1.0)', 'rgba(127,127,127,0.25)');
			break;
		case 'skinnedmesh':
			var skin_info = render.skin_info_map[pose.skin_key];
			var slot_info_map = skin_info.slot_info_map;
			var slot_info = slot_info_map[slot_key];
			drawMesh(ctx, slot_info.vertex_triangle, slot_info.vertex_setup_position, 'rgba(127,127,127,1.0)', 'rgba(127,127,127,0.25)');
			break;
		}

		ctx.restore();
	});

	pose.data.iterateBones(function (bone_key, bone)
	{
		ctx.save();
		applySpace(ctx, bone.world_space);
		drawPoint(ctx);
		ctx.restore();
	});

	drawIkConstraints(ctx, pose.data, pose.data.bones);
}

function applySpace (ctx, space)
{
	ctx.translate(space.position.x, space.position.y);
	ctx.rotate(space.rotation.rad * space.flip.x * space.flip.y);
	ctx.scale(space.scale.x * space.flip.x, space.scale.y * space.flip.y);
}

function drawCircle (ctx, color, scale)
{
	ctx.beginPath();
	ctx.arc(0, 0, 12*scale, 0, 2*Math.PI, false);
	ctx.strokeStyle = color;
	ctx.stroke();
}

function drawPoint (ctx, color, scale)
{
	scale = scale || 1;
	ctx.beginPath();
	ctx.arc(0, 0, 12*scale, 0, 2*Math.PI, false);
	ctx.strokeStyle = color || 'blue';
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(24*scale, 0);
	ctx.strokeStyle = 'red';
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(0, 24*scale);
	ctx.strokeStyle = 'green';
	ctx.stroke();
}

function drawMesh(ctx, triangles, positions, stroke_style, fill_style)
{
	ctx.beginPath();
	var sx = 0, sy = 0;
	for (var index = 0; index < triangles.length; index++)
	{
		var value = triangles[index];
		var ix = value*2, iy = ix+1;
		var x = positions[ix];
		var y = positions[iy];
		if ((index % 3) === 0) { ctx.moveTo(x, y); sx = x; sy = y; } else { ctx.lineTo(x, y); }
		if ((index % 3) === 2) { ctx.lineTo(sx, sy); }
	};
	if (fill_style)
	{
		ctx.fillStyle = fill_style;
		ctx.fill();
	}
	ctx.strokeStyle = stroke_style || 'grey';
	ctx.stroke();
}

function drawImageMesh(ctx, triangles, positions, texcoords, image, site)
{
	if (site)
	{
		var tex_matrix = new Float32Array(9);
		var site_texcoord = new Float32Array(2);

		if (site.rotate)
		{
			mat3x3Identity(tex_matrix);
			mat3x3Translate(tex_matrix, site.x, site.y);
			mat3x3Scale(tex_matrix, site.h, site.w);
			mat3x3Translate(tex_matrix, 0, 1); // bottom-left corner
			mat3x3Rotate(tex_matrix, -Math.PI/2); // -90 degrees
		}
		else
		{
			mat3x3Identity(tex_matrix);
			mat3x3Translate(tex_matrix, site.x, site.y);
			mat3x3Scale(tex_matrix, site.w, site.h);
		}
	}

	/// http://www.irrlicht3d.org/pivot/entry.php?id=1329
	for (var i = 0; i < triangles.length; )
	{
		var triangle = triangles[i++]*2;
		var position = positions.subarray(triangle, triangle+2);
		var x0 = position[0], y0 = position[1];
		var texcoord = texcoords.subarray(triangle, triangle+2);
		if (site) { texcoord = mat3x3Transform(tex_matrix, texcoord, site_texcoord); }
		var u0 = texcoord[0], v0 = texcoord[1];

		var triangle = triangles[i++]*2;
		var position = positions.subarray(triangle, triangle+2);
		var x1 = position[0], y1 = position[1];
		var texcoord = texcoords.subarray(triangle, triangle+2);
		if (site) { texcoord = mat3x3Transform(tex_matrix, texcoord, site_texcoord); }
		var u1 = texcoord[0], v1 = texcoord[1];

		var triangle = triangles[i++]*2;
		var position = positions.subarray(triangle, triangle+2);
		var x2 = position[0], y2 = position[1];
		var texcoord = texcoords.subarray(triangle, triangle+2);
		if (site) { texcoord = mat3x3Transform(tex_matrix, texcoord, site_texcoord); }
		var u2 = texcoord[0], v2 = texcoord[1];

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.closePath();
		ctx.clip();
		x1 -= x0; y1 -= y0;
		x2 -= x0; y2 -= y0; 
		u1 -= u0; v1 -= v0;
		u2 -= u0; v2 -= v0; 
		var id = 1 / (u1*v2 - u2*v1);
		var a = id * (v2*x1 - v1*x2);
		var b = id * (v2*y1 - v1*y2);
		var c = id * (u1*x2 - u2*x1);
		var d = id * (u1*y2 - u2*y1);
		var e = x0 - a*u0 - c*v0;
		var f = y0 - b*u0 - d*v0;
		ctx.transform(a, b, c, d, e, f);
		ctx.drawImage(image, 0, 0);
		ctx.restore();
	}
}

function drawIkConstraints (ctx, data, bones)
{
	data.ikc_keys.forEach(function (ikc_key)
	{
		var ikc = data.ikcs[ikc_key];
		var target = bones[ikc.target_key];
		switch (ikc.bone_keys.length)
		{
		case 1:
			var bone = bones[ikc.bone_keys[0]];
			
			ctx.beginPath();
			ctx.moveTo(target.world_space.position.x, target.world_space.position.y);
			ctx.lineTo(bone.world_space.position.x, bone.world_space.position.y);
			ctx.strokeStyle = 'yellow';
			ctx.stroke();

			ctx.save();
			applySpace(ctx, target.world_space);
			drawCircle(ctx, 'yellow', 1.5);
			ctx.restore();
			
			ctx.save();
			applySpace(ctx, bone.world_space);
			drawCircle(ctx, 'yellow', 0.5);
			ctx.restore();
			break;
		case 2:
			var parent = bones[ikc.bone_keys[0]];
			var child = bones[ikc.bone_keys[1]];
			
			ctx.beginPath();
			ctx.moveTo(target.world_space.position.x, target.world_space.position.y);
			ctx.lineTo(child.world_space.position.x, child.world_space.position.y);
			ctx.lineTo(parent.world_space.position.x, parent.world_space.position.y);
			ctx.strokeStyle = 'yellow';
			ctx.stroke();
			
			ctx.save();
			applySpace(ctx, target.world_space);
			drawCircle(ctx, 'yellow', 1.5);
			ctx.restore();
			
			ctx.save();
			applySpace(ctx, child.world_space);
			drawCircle(ctx, 'yellow', 0.75);
			ctx.restore();
			
			ctx.save();
			applySpace(ctx, parent.world_space);
			drawCircle(ctx, 'yellow', 0.5);
			ctx.restore();
			break;
		}
	});
}
