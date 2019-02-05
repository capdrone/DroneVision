import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import {
  Button,
  Icon,
  List,
  Segment,
  Header,
  Grid,
  Image,
  ListContent,
  Input,
} from 'semantic-ui-react';

import NumericInput from 'react-numeric-input';

import { getDrawInstruction } from '../utils/buttonPanelUtils';

import ButtonPanel from '../components/ButtonPanel';
import SceneCanvas from '../components/SceneCanvas';
import {
  changeTab,
  updateInstructions,
  clearInstructions,
  updateCDP,
  toggleObstacles,
  updateDroneConnectionStatus,
  rotateDrone,
  addObjectToScene,
  updateSceneObj,
} from '../store/store';

const { ipcRenderer } = window.require('electron');

const defaultObj = {
  length: 2,
  width: 2,
  height: 2,
  position: {
    x: 0,
    y: 0,
    z: 0,
  },
};

class SceneBuilder extends Component {
  constructor(props) {
    super(props);
    this.objId = 1;
    const { scale } = this.props;
    this.state = {
      limits: {
        maxX: scale / 2,
        maxY: scale,
        maxZ: scale / 2,
        minX: -scale / 2,
        minY: 1,
        minZ: -scale / 2,
      },
      startingPoint: { x: 0, y: 1, z: 0 },
      selectedObj: {},
    };
  }

  componentDidMount() {
    // Listen for flight import from main process
    ipcRenderer.on('file-opened', (event, flightInstructions) => {
      this.props.updateInstructions(flightInstructions);
    });
  }

  createCube = ({ id, length, width, height, position }) => {
    const { x, y, z } = position;
    const objGeometry = new THREE.CubeGeometry(width, height, length);
    const objMaterial = new THREE.MeshPhongMaterial({
      color: 0x6666ff,
      flatShading: false,
    });
    const objEdges = new THREE.EdgesGeometry(objGeometry);
    const objLines = new THREE.LineSegments(
      objEdges,
      new THREE.LineBasicMaterial({ color: 0xccff00 })
    );
    const obj = new THREE.Mesh(objGeometry, objMaterial);
    obj.position.set(x, y, z);
    objLines.position.set(x, y, z);

    const objId = id || this.objId++;
    obj.name = `${objId}`;
    objLines.name = `${objId}-lines`;
    const newObj = {
      id: objId,
      name: `obj${objId}`,
      length,
      width,
      height,
      position,
      ref: obj,
      lineRef: objLines,
    };

    return newObj;
  };

  addAndCreateObj = () => {
    const newObj = this.createCube(defaultObj);
    this.props.canvasScene.add(newObj.ref);
    this.props.canvasScene.add(newObj.lineRef);
    this.props.addObjectToScene(newObj);
    const previouslySelectedObj = this.state.selectedObj;
    if (previouslySelectedObj.id) {
      previouslySelectedObj.lineRef.material.color = new THREE.Color(0x000000);
    }
    this.setState({ selectedObj: newObj });
  };

  handleObjChange = (valNum, valStr, inputElem) => {
    const sceneObj = this.props.sceneObjects.find(
      sceneObj => Number(inputElem.id) === sceneObj.id
    );
    // propertyName is length/width/height.
    const propertyName = inputElem.name;
    sceneObj[propertyName] = valNum;
    // need to get reference to the object in order to remove it
    const objToRemove = this.props.canvasScene.getObjectByName(
      sceneObj.ref.name
    );
    const lineToRemove = this.props.canvasScene.getObjectByName(
      sceneObj.lineRef.name
    );
    this.props.canvasScene.remove(objToRemove);
    this.props.canvasScene.remove(lineToRemove);
    this.props.updateSceneObj(sceneObj);
    const newObj = this.createCube(sceneObj);
    newObj.lineRef.material.color = new THREE.Color(0xccff00);

    this.props.canvasScene.add(newObj.ref);
    this.props.canvasScene.add(newObj.lineRef);
    this.setState({ selectedObj: newObj });
  };

  handleButtonClick = dirString => {
    const drawInstruction = getDrawInstruction(dirString);
    const selectedObj = this.state.selectedObj;
    console.log(selectedObj)
    const [z, x, y] = drawInstruction;
    selectedObj.ref.translateX(x);
    selectedObj.lineRef.translateX(x);
    selectedObj.ref.translateY(y);
    selectedObj.lineRef.translateY(y);
    selectedObj.ref.translateZ(z);
    selectedObj.lineRef.translateZ(z);

    const { x: newX, y: newY, z: newZ } = selectedObj.ref.position;
    const updatedObj = { ...selectedObj };
    updatedObj.position = { x: newX, y: newY, z: newZ };
    updatedObj.lineRef.material.color = new THREE.Color(0xccff00);
    this.props.updateSceneObj(updatedObj);
  };

  handleObjectSelection = evt => {
    const previouslySelectedObj = this.state.selectedObj;
    previouslySelectedObj.lineRef.material.color = new THREE.Color(0x000000);
    const selectedObj = this.props.sceneObjects.find(
      sceneObj => sceneObj.id === Number(evt.currentTarget.id)
    );
    selectedObj.lineRef.material.color = new THREE.Color(0xccff00);

    this.setState({ selectedObj });
  };

  render() {
    const { limits } = this.state;
    const { droneOrientation, sceneObjects } = this.props;

    const currentPoint = { x: 10, y: 10, z: 10 };
    const leftDisabled = currentPoint.x === limits.maxX;
    const rightDisabled = currentPoint.x === limits.minX;
    const forwardDisabled = currentPoint.z === limits.maxZ;
    const reverseDisabled = currentPoint.z === limits.minZ;
    const upDisabled = currentPoint.y === limits.maxY;
    const downDisabled = currentPoint.y === limits.minY;

    return (
      <div id="build-screen">
        <Grid columns={3} padded>
          <Grid.Row>
            <Grid.Column width={3}>
              <Grid.Row>
                <Image
                  src={require('../assets/images/helper-images/build-instructions.png')}
                  size="large"
                />
              </Grid.Row>
              <Grid.Row>
                <Button onClick={this.addAndCreateObj}>
                  <Button.Content visible>
                    <Icon name="plus" />
                    Create New Object
                  </Button.Content>
                </Button>
              </Grid.Row>

              <Grid.Row>
                <Segment inverted>
                  <List divided inverted selection>
                    <List.Header>
                      <i>Your objects</i>
                    </List.Header>
                    {sceneObjects
                      .sort((a, b) => a.id - b.id)
                      .map(sceneObj => {
                        return (
                          <List.Item
                            className="flight-message-single"
                            key={sceneObj.id}
                            onClick={this.handleObjectSelection}
                            id={sceneObj.id}
                          >
                            <List.Content>Name: {sceneObj.name}</List.Content>
                            <ListContent>
                              {`Width:   `}
                              <NumericInput
                                id={sceneObj.id}
                                name={'width'}
                                size={3}
                                min={1}
                                max={this.props.scale}
                                value={sceneObj.width}
                                onChange={this.handleObjChange}
                              />
                              {`   m.`}
                            </ListContent>
                            <ListContent>
                              {`Length:   `}
                              <NumericInput
                                id={sceneObj.id}
                                name={'length'}
                                size={3}
                                min={1}
                                max={this.props.scale}
                                value={sceneObj.length}
                                onChange={this.handleObjChange}
                              />
                              {`   m.`}
                            </ListContent>
                            <ListContent>
                              {`Height:   `}
                              <NumericInput
                                id={sceneObj.id}
                                name={'height'}
                                size={3}
                                min={1}
                                max={this.props.scale}
                                value={sceneObj.height}
                                onChange={this.handleObjChange}
                              />
                              {`   m.`}
                            </ListContent>
                          </List.Item>
                        );
                      })}
                  </List>
                </Segment>
              </Grid.Row>
            </Grid.Column>

            <Grid.Column width={9}>
              <Header as="h1" dividing id="centered-padded-top">
                <Icon name="building" />
                <Header.Content>
                  Scene Builder
                  <Header.Subheader>
                    <i>Add objects to your scene</i>
                  </Header.Subheader>
                </Header.Content>
              </Header>

              <Grid.Row>
                <Grid.Column>
                  <SceneCanvas />
                </Grid.Column>
              </Grid.Row>
              {sceneObjects.length ? (
                <Grid.Row>
                  <Grid columns={3} padded centered>
                    <Grid.Row>
                      <Grid.Column
                        as="h1"
                        textAlign="center"
                        style={{
                          color: '#ffffff',
                          backgroundColor: '#00a651',
                          borderStyle: 'solid',
                          borderColor: '#484848',
                        }}
                      >
                        Up + Strafe
                        <ButtonPanel
                          leftDisabled={leftDisabled}
                          rightDisabled={rightDisabled}
                          forwardDisabled={forwardDisabled}
                          reverseDisabled={reverseDisabled}
                          allDisabled={upDisabled}
                          clickHandler={this.handleButtonClick}
                          type="U"
                          droneOrientation={droneOrientation}
                        />
                      </Grid.Column>

                      <Grid.Column
                        as="h1"
                        textAlign="center"
                        style={{
                          color: '#ffffff',
                          backgroundColor: '#afafaf',
                          borderStyle: 'solid',
                          borderColor: '#484848',
                        }}
                      >
                        Strafe
                        <ButtonPanel
                          leftDisabled={leftDisabled}
                          rightDisabled={rightDisabled}
                          forwardDisabled={forwardDisabled}
                          reverseDisabled={reverseDisabled}
                          allDisabled={false}
                          clickHandler={this.handleButtonClick}
                          type="C"
                          droneOrientation={droneOrientation}
                        />
                      </Grid.Column>
                      <Grid.Column
                        as="h1"
                        style={{
                          color: '#ffffff',
                          backgroundColor: '#00aeef',
                          borderStyle: 'solid',
                          borderColor: '#484848',
                        }}
                        textAlign="center"
                      >
                        Down + Strafe
                        <ButtonPanel
                          leftDisabled={leftDisabled}
                          rightDisabled={rightDisabled}
                          forwardDisabled={forwardDisabled}
                          reverseDisabled={reverseDisabled}
                          allDisabled={downDisabled}
                          clickHandler={this.handleButtonClick}
                          type="D"
                          droneOrientation={droneOrientation}
                        />
                      </Grid.Column>
                    </Grid.Row>
                  </Grid>
                </Grid.Row>
              ) : null}

              <Grid.Row>
                <Grid columns={2} padded>
                  <Grid.Column textAlign="center">
                    <Link to={'/'}>
                      <Button onClick={() => this.props.changeTab('run')}>
                        Build Flight Path!
                      </Button>
                    </Link>
                  </Grid.Column>

                  <Grid.Column>
                    {this.props.obstacles ? (
                      <Button onClick={this.props.toggleObstacles}>
                        Remove Obstacles
                      </Button>
                    ) : (
                      <Button onClick={this.props.toggleObstacles}>
                        Insert Obstacles
                      </Button>
                    )}
                  </Grid.Column>
                </Grid>
              </Grid.Row>
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </div>
    );
  }
}

const mapState = state => {
  return {
    scale: state.scale,
    droneOrientation: state.droneOrientation,
    startingPosition: state.startingPosition,
    voxelSize: state.voxelSize,
    obstacles: state.obstacles,
    canvasScene: state.canvasScene,
    sceneObjects: state.sceneObjects,
  };
};

const mapDispatch = dispatch => {
  return {
    changeTab: tabName => dispatch(changeTab(tabName)),
    toggleObstacles: () => {
      dispatch(toggleObstacles());
    },
    addObjectToScene: selectedObj => {
      dispatch(addObjectToScene(selectedObj));
    },
    updateSceneObj: updatedObj => dispatch(updateSceneObj(updatedObj)),
  };
};

export default connect(
  mapState,
  mapDispatch
)(SceneBuilder);
