"""Build web-ready jewel-case geometry from the downloaded OBJ/MTL bundles.

Run with Blender so its OBJ importer and glTF exporter are available:

    blender --background --factory-startup --python scripts/models/build-jewel-case-glbs.py

Each bundle models the clear shell CLOSED, as one fused mesh, in its own
axis convention.  This script does the two jobs that cannot be done reliably
at runtime:

1. ORIENT every part into one canonical frame — front of the case toward
   glTF +Z, hinge/spine toward -X, up toward +Y.  The conventions were
   measured from the sources (the detailed bundle's booklet plane sits at
   -Y; the smudge tray's disc seat faces -Z), so each model gets an explicit
   rotation instead of a bounding-box guess.

2. SPLIT the fused clear shell at the real lid seam with a plane bisect, so
   the hinged "Lid" is the actual front panel + skirt and the "Base" stays
   with the tray.  A runtime triangle-centroid split cannot do this: skirt
   triangles span most of the depth and end up in the wrong half whole.

Parts keep their SHARED assembly coordinates (no per-part recentering) so
the tray, lid, and base stay aligned exactly as the artist placed them.
The application scales/centers the whole assembly at load time and owns all
physical materials; exporting geometry-only GLBs keeps the assets small.
"""

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path("/home/wavefire")
SOURCE = ROOT / "Downloads/enochzhu/cd"
OUTPUT = ROOT / "development/enochzhu/static/models"

# Blender's OBJ import and glTF export round-trip the source coordinates
# unchanged in three.js space, with blender = (x, -z, y) relative to the OBJ
# axes.  Seams and rotations below are given in BLENDER coordinates.
BUILDS = {
	"jewel-case-detailed.glb": {
		"glass": SOURCE / "Jewel Case/Clear Plastic.obj",
		"tray": SOURCE / "Jewel Case/Black Plas1.obj",
		# The tray card that wraps behind the perforated tray. Without it the
		# tray's cutouts expose the clear back panel, whose environment
		# reflections read as grey smudges floating on the black deck.
		"card": SOURCE / "Jewel Case/Rear Insert.obj",
		# depth = obj Y = blender Z, front at min (booklet plane at obj y=-0.04).
		# The vertex histogram shows the lid rim ~38% behind the front face.
		"seam_co": Vector((0.0, 0.0, -0.0216)),
		"seam_no": Vector((0.0, 0.0, 1.0)),
		"lid_side": "negative",
		# front -Z -> -Y so glTF export (x, z, -y) lands the front on +Z
		"orient": Matrix.Rotation(math.radians(-90.0), 4, "X"),
	},
	"jewel-case-charcoal.glb": {
		"glass": SOURCE / "Jewel Case(smudge)/Glass.obj",
		"tray": SOURCE / "Jewel Case(smudge)/Charcoal.obj",
		# depth = obj Z = blender -Y, front at obj MAX z — the dense low-z tray
		# geometry that suggested otherwise is its underside ribbing, verified
		# by rendering. This source is therefore already in canonical
		# orientation; the lid is the high-z ~40% with its rim at the vertex
		# cluster around obj z 0.00206.
		"seam_co": Vector((0.0, -0.00206, 0.0)),
		"seam_no": Vector((0.0, 1.0, 0.0)),
		"lid_side": "negative",
		"orient": Matrix.Identity(4),
	},
}


def reset_scene() -> None:
	bpy.ops.object.select_all(action="SELECT")
	bpy.ops.object.delete(use_global=False)


def import_part(path: Path, name: str) -> bpy.types.Object:
	bpy.ops.wm.obj_import(filepath=str(path))
	imported = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
	if not imported:
		raise RuntimeError(f"No mesh imported from {path}")

	bpy.ops.object.select_all(action="DESELECT")
	for obj in imported:
		obj.select_set(True)
	bpy.context.view_layer.objects.active = imported[0]
	if len(imported) > 1:
		bpy.ops.object.join()

	obj = bpy.context.view_layer.objects.active
	obj.name = name
	obj.data.name = name
	# Materials are recreated as MeshPhysicalMaterial in the browser.  Keep UVs
	# and normals, but omit the desktop-oriented material payload.
	obj.data.materials.clear()
	return obj


def bisect_keep(obj: bpy.types.Object, co: Vector, no: Vector, side: str) -> None:
	"""Plane-cut the mesh and keep one side.

	NO fill: the seam plane slices walls, ribs, and latch details all at once,
	and Blender's fill triangulates that whole cross-section — including bogus
	faces that span the case interior.  Rendered as transmission glass those
	read as a grey wedge floating over the tray and speckle along the seam.
	The open ~1mm wall edge is invisible by comparison.
	"""
	bpy.ops.object.select_all(action="DESELECT")
	obj.select_set(True)
	bpy.context.view_layer.objects.active = obj
	bpy.ops.object.mode_set(mode="EDIT")
	bpy.ops.mesh.select_all(action="SELECT")
	bpy.ops.mesh.bisect(
		plane_co=co,
		plane_no=no,
		use_fill=False,
		clear_inner=side == "positive",
		clear_outer=side == "negative",
	)
	bpy.ops.object.mode_set(mode="OBJECT")


def duplicate(obj: bpy.types.Object, name: str) -> bpy.types.Object:
	copy = obj.copy()
	copy.data = obj.data.copy()
	copy.name = name
	copy.data.name = name
	bpy.context.collection.objects.link(copy)
	return copy


def build(output_name: str, spec: dict) -> None:
	reset_scene()
	glass = import_part(spec["glass"], "Lid")
	tray = import_part(spec["tray"], "Tray")
	parts = [glass, tray]
	if "card" in spec:
		parts.append(import_part(spec["card"], "Card"))

	base = duplicate(glass, "Base")
	parts.append(base)
	bisect_keep(glass, spec["seam_co"], spec["seam_no"], spec["lid_side"])
	other = "positive" if spec["lid_side"] == "negative" else "negative"
	bisect_keep(base, spec["seam_co"], spec["seam_no"], other)

	for obj in parts:
		obj.data.transform(spec["orient"])
		obj.data.update()

	OUTPUT.mkdir(parents=True, exist_ok=True)
	bpy.ops.object.select_all(action="SELECT")
	bpy.ops.export_scene.gltf(
		filepath=str(OUTPUT / output_name),
		export_format="GLB",
		export_materials="NONE",
		export_yup=True,
	)


for filename, model_spec in BUILDS.items():
	build(filename, model_spec)
