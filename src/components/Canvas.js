import React, { Component } from 'react';
import * as THREE from 'three';
import OrbitControls from 'three-orbitcontrols';
import PubSub from 'pubsub-js';
const keyboard = {};

function keyDown(event) {
  keyboard[event.keyCode] = true;
}

function keyUp(event) {
  keyboard[event.keyCode] = false;
}

// var geometry = new THREE.BoxGeometry(1, 1, 1);
// var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// var cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

window.addEventListener('keydown', keyDown);
window.addEventListener('keyup', keyUp);

class Canvas extends Component {
  constructor() {
    super();

    this.state = {
      landLine: null,
    };

    //renderer
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(640, 360, false);

    //scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa9a9a9);

    //camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    this.camera.position.set(-2.8, 5.4, -14.8);

    //controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; //an animation loop is required when damping or auto-rotation are enabled
    this.controls.dampingFactor = 1;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2;

    this.planeGeo = new THREE.PlaneBufferGeometry(10, 10, 10, 10);
    this.planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x488384,
      wireframe: true,
    });
    this.floor = new THREE.Mesh(this.planeGeo, this.planeMaterial);
    this.floor.rotation.x = Math.PI / 2;
    // this.floor.position.x = 0;

    this.scene.add(this.floor);

    //Triangle
    const geometry = new THREE.CylinderBufferGeometry(0, 10, 30, 4, 1);
    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    for (let i = 0; i < 5; i++) {
      const triangle = new THREE.Mesh(geometry, material);
      triangle.position.x = 0;
      triangle.position.y = 0;
      triangle.position.z = 200;
      triangle.updateMatrix();
      triangle.matrixAutoUpdate = false;
      this.scene.add(triangle);
    }

    //Takeoff Yellow Line
    const yellowLineMaterial = new THREE.LineBasicMaterial({ color: 'yellow' });
    const yellowLineGeometry = new THREE.Geometry();
    yellowLineGeometry.vertices.push(new THREE.Vector3(0, 0, 0));
    yellowLineGeometry.vertices.push(new THREE.Vector3(0, 1, 0));

    const yellowLine = new THREE.Line(yellowLineGeometry, yellowLineMaterial);
    this.scene.add(yellowLine);
  }

  componentDidMount() {
    document.getElementById('canvas').appendChild(this.renderer.domElement);
    this.animate();
    PubSub.subscribe('new-line', (msg, points) => {
      const { point1, point2 } = points;
      //create a LineBasicMaterial
      const material = new THREE.LineBasicMaterial({ color: 'red' });
      const geometry = new THREE.Geometry();
      geometry.vertices.push(new THREE.Vector3(point1.x, point1.y, point1.z));
      geometry.vertices.push(new THREE.Vector3(point2.x, point2.y, point2.z));

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);

      //Land Line
      if (this.state.landLine) {
        this.scene.remove(this.state.landLine);
      }
      const landLineMaterial = new THREE.LineBasicMaterial({ color: 'blue' });
      const landLineGeometry = new THREE.Geometry();
      landLineGeometry.vertices.push(
        new THREE.Vector3(point2.x, point2.y, point2.z)
      );
      landLineGeometry.vertices.push(new THREE.Vector3(point2.x, 0, point2.z));

      const landLine = new THREE.Line(landLineGeometry, landLineMaterial);
      landLine.name = 'landLine';
      this.scene.add(landLine);
      this.setState({ landLine: landLine });
    });
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    // console.dir(this.camera);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  render() {
    return <div id="canvas" />;
  }
}

export default Canvas;
