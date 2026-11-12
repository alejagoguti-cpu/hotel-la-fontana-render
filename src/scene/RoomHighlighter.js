import * as THREE from 'three';
import { loopToShape } from './HotelBuildingBuilder.js';

const PISO2_Y = 3.02;

export class RoomHighlighter {
  constructor(scene) {
    this.scene = scene;
    this.roomGroups = new Map(); // id -> THREE.Group
    this.roomMeshes = []; // for raycasting
    this.hoveredMesh = null;
    this.selectedRoomId = null;

    // Materials
    this.matNormal = new THREE.MeshBasicMaterial({
      color: 0xd81e28,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.matHover = new THREE.MeshBasicMaterial({
      color: 0xff3b47,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.matSelected = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.wireframeMatNormal = new THREE.LineBasicMaterial({
      color: 0xff4d58,
      transparent: true,
      opacity: 0.85
    });

    this.wireframeMatSelected = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      transparent: true,
      opacity: 1.0
    });
  }

  build(roomsData) {
    for (const room of roomsData) {
      const group = new THREE.Group();
      group.name = `RoomVolume_${room.id}`;

      // Build 3D volume matching room shape
      const shape = loopToShape(room.mainLoop);
      const height = 2.85;
      const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(geo, this.matNormal.clone());
      mesh.position.y = PISO2_Y + 0.05;
      mesh.userData = {
        isRoomVolume: true,
        roomId: room.id,
        roomNumber: room.number,
        title: room.title,
        data: room
      };

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        this.wireframeMatNormal.clone()
      );
      edges.position.copy(mesh.position);

      group.add(mesh);
      group.add(edges);
      this.scene.add(group);

      this.roomGroups.set(room.id, { group, mesh, edges });
      this.roomMeshes.push(mesh);
    }
  }

  setHover(roomId) {
    for (const [id, item] of this.roomGroups.entries()) {
      if (id === this.selectedRoomId) continue;
      if (id === roomId) {
        item.mesh.material = this.matHover;
        item.edges.material.color.setHex(0xffffff);
      } else {
        item.mesh.material = this.matNormal;
        item.edges.material.color.setHex(this.edgeColor ?? 0xff4d58);
      }
    }
  }

  /** 'plan': estilo planta comercial (naranja, relleno sutil) · 'default': volúmenes rojos del exterior. */
  setTheme(theme) {
    const plan = theme === 'plan';
    this.matNormal.color.setHex(plan ? 0xf26b1d : 0xd81e28); this.matNormal.opacity = plan ? 0.06 : 0.38;
    this.matHover.color.setHex(plan ? 0xff7a2e : 0xff3b47); this.matHover.opacity = plan ? 0.42 : 0.58;
    this.matSelected.color.setHex(plan ? 0xff8a3d : 0xffffff); this.matSelected.opacity = plan ? 0.22 : 0.72;
    this.wireframeMatSelected.color.setHex(plan ? 0xffb37a : 0xffffff);
    this.edgeColor = plan ? 0xff7a2e : 0xff4d58;
    for (const item of this.roomGroups.values()) item.edges.material.color?.setHex(this.edgeColor);
    this.setSelected(this.selectedRoomId);
  }

  setSelected(roomId) {
    this.selectedRoomId = roomId;
    for (const [id, item] of this.roomGroups.entries()) {
      if (id === roomId) {
        item.mesh.material = this.matSelected;
        item.edges.material = this.wireframeMatSelected;
      } else {
        item.mesh.material = this.matNormal;
        item.edges.material = this.wireframeMatNormal;
      }
    }
  }

  setVisibility(visible) {
    for (const item of this.roomGroups.values()) {
      item.group.visible = visible;
    }
  }
}
