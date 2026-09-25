"""Render img/saturn-v.png for Moon Rocket from the Saturn V Blender model (/workspace/saturn5/saturn_v.blend).
Run: blender --background --python tools/render_saturn_sprite.py  (then crop/resize to 480 px tall, see README)"""
import bpy, math
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath="/workspace/saturn5/saturn_v.blend")
sc = bpy.context.scene
for n in ("LaunchPad", "FlameTrench"):
    o = bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o, do_unlink=True)
pts = []
for o in sc.objects:
    if o.type == 'MESH' and o.visible_get():
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
xs = [p.x for p in pts]; zs = [p.z for p in pts]
x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
print("BBOX x", x0, x1, "z", z0, z1)
w, h = x1 - x0, z1 - z0
pad = 1.03
cam = sc.camera
cam.data.type = 'ORTHO'
cam.data.ortho_scale = h * pad
cam.location = ((x0 + x1) / 2, -400, (z0 + z1) / 2)
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.clip_end = 2000
H = 1200
sc.render.resolution_y = H
sc.render.resolution_x = int(math.ceil(H * (w * pad) / (h * pad) / 2) * 2) + 8
sc.render.resolution_percentage = 100
sc.render.film_transparent = True
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 32
sc.cycles.use_denoising = True
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
# brighter, even light from the camera side so the white/black roll pattern reads at small size
if sc.world and sc.world.node_tree:
    bg = sc.world.node_tree.nodes.get("Background")
    if bg: bg.inputs["Strength"].default_value = 1.2; bg.inputs["Color"].default_value = (0.8, 0.85, 0.95, 1)
ld = bpy.data.lights.new("KeyFront", type='SUN'); ld.energy = 3.0
lo = bpy.data.objects.new("KeyFront", ld); sc.collection.objects.link(lo)
lo.rotation_euler = (math.radians(70), 0, math.radians(-25))
sc.render.filepath = "/workspace/saturn5/sprite/saturn_v_side.png"
bpy.ops.render.render(write_still=True)
print("DONE", sc.render.resolution_x, sc.render.resolution_y)
