import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import OrbitControls from 'three-orbitcontrols';
import PubSub from 'pubsub-js';
import buildCanvasSkybox from '../ThreeJSModules/BuildCanvasSkybox';
import droneModel from '../ThreeJSModules/Drone3DModel';
import cardinalDirections from '../ThreeJSModules/CardinalDirections';
import Obstacles from '../ThreeJSModules/Obstacles';
import _ from 'lodash';
import { updateCDP } from '../store/store';
import throttle from 'lodash/throttle';

const { ipcRenderer } = window.require('electron');

class BuildCanvas extends Component {
  constructor(props) {
    super(props);

    //RENDERER
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(640, 360, false);

    //SCENE
    this.scene = new THREE.Scene();

    //CAMERA
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    this.camera.position.set(-2.8, 5.4, -14.8);
    // this.camera.position.set(
    //   this.props.startingPosition.x,
    //   this.props.startingPosition.y,
    //   this.props.startingPosition.z
    // );

    //ORBITAL CONTROLS
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableKeys = false;
    this.controls.enableDamping = true; //an animation loop is required when damping or auto-rotation are enabled
    this.controls.dampingFactor = 1;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 50;
    // this.controls.maxPolarAngle = Math.PI / 2;

    // //SKYBOX
    this.scene.add(buildCanvasSkybox);

    //DRONE 3D MODEL
    this.drone3DModel = droneModel.clone();
    this.drone3DModel.position.set(
      this.props.buildDronePosition.x,
      this.props.buildDronePosition.y,
      this.props.buildDronePosition.z
    );

    this.controls.target = this.drone3DModel.position;
    this.drone3DModel.rotation.y = Math.PI;
    this.drone3DModel.scale.set(0.1, 0.1, 0.1);

    this.scene.add(this.drone3DModel);

    //GRID
    this.gridEdgeLength = this.props.voxelSize;
    // this.props.scale / (this.props.scale / this.props.voxelSize);

    this.gridGeo = new THREE.PlaneBufferGeometry(
      this.props.voxelSize,
      this.props.voxelSize,
      this.props.scale,
      this.props.scale
    );
    this.gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x488384,
      wireframe: true,
    });
    this.grid = new THREE.Mesh(this.gridGeo, this.gridMaterial);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.set(0, this.gridEdgeLength * -0.5, 0);
    this.scene.add(this.grid);

    // GRID CUBE
    const gridCubeGeometry = new THREE.BoxGeometry(
      this.gridEdgeLength,
      this.gridEdgeLength,
      this.gridEdgeLength
    );

    const gridCubeEdges = new THREE.EdgesGeometry(gridCubeGeometry);
    const gridCubeLines = new THREE.LineSegments(
      gridCubeEdges,
      new THREE.LineBasicMaterial({ color: 0x488384 })
    );
    //This line is to remind readers that the cube is centered
    gridCubeLines.position.set(0, 0, 0);
    this.scene.add(gridCubeLines);

    //NORTH STAR
    //EAST STAR
    //SOUTH STAR
    //WEST STAR
    this.scene.add(cardinalDirections);

    //TAKEOFF LINE
    const takeoffLineMaterial = new THREE.LineBasicMaterial({
      color: 'yellow',
    });
    const takeoffLineGeometry = new THREE.Geometry();
    takeoffLineGeometry.vertices.push(new THREE.Vector3(0, 0, 0));
    takeoffLineGeometry.vertices.push(new THREE.Vector3(0, 1, 0));

    this.takeoffLine = new THREE.Line(takeoffLineGeometry, takeoffLineMaterial);
    this.takeoffLine.position.set(0, this.gridEdgeLength * -0.5, 0);
    this.scene.add(this.takeoffLine);

    //AMBIENT LIGHT
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);
  }

  componentDidMount() {
    document.getElementById('canvas').appendChild(this.renderer.domElement);
    this.animate();

    //OBSTACLES (toggled by redux store)
    if (this.props.obstacles) {
      this.scene.add(Obstacles);
    }
    //OBSTACLES (toggled by redux store)
    if (!this.props.obstacles) {
      this.scene.remove(Obstacles);
    }

    PubSub.subscribe('draw-path', (msg, flightCoords) => {
      if (this.line) {
        this.scene.remove(this.line);
        this.scene.remove(this.landLine);
      }

      //DRAWS FLIGHT PATH
      const material = new THREE.LineBasicMaterial({
        color: 0xff0000,
      });
      const geometry = new THREE.Geometry();
      const startingPoint = { x: 0, y: 1, z: 0 };
      const point = { ...startingPoint };
      geometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));

      flightCoords.forEach(command => {
        const [z, x, y] = command;
        point.x += x;
        point.y += y;
        point.z += z;
        // x -> z
        // y -> x
        // z -> y
        geometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
      });
      this.line = new THREE.Line(geometry, material);

      //move drone to the tip of the path
      this.drone3DModel.position.set(
        point.x,
        point.y - this.gridEdgeLength * 0.5,
        point.z
      );

      //shift position of line down because the plane had to be shifted down in 3d space
      this.line.position.set(0, this.gridEdgeLength * -0.5, 0);
      this.scene.add(this.line);

      if (!_.isEqual(point, startingPoint)) {
        const landLineGeometry = new THREE.Geometry();
        landLineGeometry.vertices.push(new THREE.Vector3(point.x, 0, point.z));
        const landLineMaterial = new THREE.LineBasicMaterial({ color: 'blue' });

        landLineGeometry.vertices.push(
          new THREE.Vector3(point.x, point.y, point.z)
        );
        this.landLine = new THREE.Line(landLineGeometry, landLineMaterial);
        this.landLine.position.set(0, this.gridEdgeLength * -0.5, 0);
        this.scene.add(this.landLine);
      }
    });
  }

  componentDidUpdate = () => {
    //OBSTACLES (toggled by redux store)
    if (this.props.obstacles) {
      this.scene.add(Obstacles);
    }
    //OBSTACLES (toggled by redux store)
    if (!this.props.obstacles) {
      this.scene.remove(Obstacles);
    }
  };
  moveDrone = object => {
    let differenceX = this.props.currentDronePosition.x - object.position.x;
    let differenceY = this.props.currentDronePosition.y - object.position.y;
    let differenceZ = this.props.currentDronePosition.z - object.position.z;
    let speed;

    if (differenceX > 8 || differenceY > 8 || differenceZ > 8) {
      speed = 0.05;
    } else if (differenceX > 6 || differenceY > 6 || differenceZ > 6) {
      speed = 0.04;
    } else if (differenceX > 4 || differenceY > 4 || differenceZ > 4) {
      speed = 0.03;
    } else if (differenceX > 2 || differenceY > 2 || differenceZ > 2) {
      speed = 0.02;
    } else {
      speed = 0.01;
    }

    if (object.position.x !== this.props.currentDronePosition.x) {
      if (differenceX > 0) {
        object.position.x = object.position.x + speed;
      }
      if (differenceX < 0) {
        object.position.x = object.position.x - speed;
      }
      if (Math.abs(differenceX) < speed + 0.01) {
        object.position.x = this.props.currentDronePosition.x;
      }
    }
    if (object.position.y !== this.props.currentDronePosition.y) {
      if (differenceY > 0) {
        object.position.y = object.position.y + speed;
      }
      if (differenceY < 0) {
        object.position.y = object.position.y - speed;
      }
      if (Math.abs(differenceY) < speed + 0.01) {
        object.position.y = this.props.currentDronePosition.y;
      }
    }
    if (object.position.z !== this.props.currentDronePosition.z) {
      if (differenceZ > 0) {
        object.position.z = object.position.z + speed;
      }
      if (differenceZ < 0) {
        object.position.z = object.position.z - speed;
      }
      if (Math.abs(differenceZ) < speed + 0.01) {
        object.position.z = this.props.currentDronePosition.z;
      }
    }
  };

  animate = async () => {
    requestAnimationFrame(this.animate);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  render() {
    return <div id="canvas" />;
  }
}

const mapState = state => {
  return {
    scale: state.scale,
    voxelSize: state.voxelSize,
    currentDronePosition: state.currentDronePosition,
    startingPosition: state.startingPosition,
    obstacles: state.obstacles,
    buildDronePosition: state.buildDronePosition,
  };
};

// const mapDispatch = dispatch => {
//   return {
//     changeRoll: newRoll => {
//       dispatch(changeRoll(newRoll));
//     },
//     changePitch: newPitch => {
//       dispatch(changePitch(newPitch));
//     },
//     changeYaw: newYaw => {
//       dispatch(changeYaw(newYaw));
//     },
//   };
// };

export default connect(
  mapState,
  null
)(BuildCanvas);
