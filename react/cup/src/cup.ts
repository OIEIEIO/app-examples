import { Mesh } from "@babylonjs/core";
import { BitByBitBase, Draw } from "bitbybit-core";
import { TransformNode, Engine } from '@babylonjs/core';
import { OCCT } from "bitbybit-core/lib/api/bitbybit/occt/occt";

export class CupLogic {

    private bitbybit: BitByBitBase;
    private occt: OCCT;

    private cup;
    private cupMesh;
    private pointLight;

    private white = '#ffffff'


    constructor(bitbybit: BitByBitBase) {
        this.bitbybit = bitbybit;
        this.occt = bitbybit.occt as OCCT;
    }

    private node: TransformNode;

    async initScene(engine: Engine) {

        if (this.pointLight) {
            this.pointLight.dispose();
        }
        
        this.bitbybit.babylon.scene.adjustActiveArcRotateCamera({
            position: [-5, 20, -35],
            lookAt: [0, 5, 0],
            maxZ: 1000,
            panningSensibility: 1000,
            wheelPrecision: 1
        })

        this.pointLight = this.bitbybit.babylon.scene.drawPointLight({
            position: [10, 20, 10],
            diffuse: this.white,
            specular: this.white,
            intensity: 4000,
            radius: 0,
            shadowDarkness: 0,
            enableShadows: true,
            shadowGeneratorMapSize: 2056
        })

        const ground = await this.bitbybit.occt.shapes.face.createCircleFace({ center: [0, 0, 0], radius: 20, direction: [0, 1, 0] })

        const di = new Draw.DrawOcctShapeOptions();
        di.faceColour = this.white;
        await this.bitbybit.draw.drawAnyAsync({ entity: ground, options: di }) as Mesh;

        this.node = this.bitbybit.babylon.node.createWorldNode();

        engine.runRenderLoop(()=> {
            this.bitbybit.babylon.node.rotate({ node: this.node, axis: [0, 1, 0], angle: 0.1 });
        })
    }

    async compute(cupHeight, cupRadius, cupThickness, cupHandleDistance, cupHandleHeight) {
        if (this.cupMesh) {
            this.cupMesh.dispose();
        }

        const faceColour = '#444444';

        const roundingRadius = cupThickness / 3;
        const cupHolderLength = 2;
        const cupHolderThickness = cupThickness * 1.5;
        const cupHolderHeight = this.mapRange(cupHandleHeight, 0, 1, cupHolderThickness * 2 + roundingRadius * 2.5, (cupHeight - cupThickness * 2));

        const cupHolderWidth = cupHandleDistance + cupThickness * 2;
        const edgeColour = this.white;

        const box = await this.bitbybit.occt.shapes.solid.createBox({
            width: cupHolderWidth * 2,
            height: cupHolderHeight,
            length: cupHolderLength,
            center: [cupRadius, cupHeight / 2, 0]
        });

        const boxInside = await this.bitbybit.occt.shapes.solid.createBox({
            width: (cupHolderWidth * 2) - (cupHolderThickness * 2),
            height: cupHolderHeight - (cupHolderThickness * 2),
            length: cupHolderLength * 1.2,
            center: [cupRadius, cupHeight / 2, 0]
        });


        const boolHolder = await this.occt.booleans.difference({
            shape: box,
            shapes: [boxInside],
            keepEdges: false
        });

        const cylinder = await this.occt.shapes.solid.createCylinder({
            center: [0, 0, 0],
            radius: cupRadius,
            height: cupHeight
        });

        const baseUnion = await this.occt.booleans.union({
            shapes: [cylinder, boolHolder],
            keepEdges: false
        });

        const cylinderInside = await this.occt.shapes.solid.createCylinder({
            center: [0, cupThickness, 0],
            radius: cupRadius - cupThickness,
            height: cupHeight
        });

        const cupBase = await this.occt.booleans.difference({
            shape: baseUnion,
            shapes: [cylinderInside],
            keepEdges: false
        });

        this.cup = await this.occt.fillets.filletEdges({
            radius: roundingRadius,
            shape: cupBase
        });

        const di = new Draw.DrawOcctShapeOptions();
        di.faceColour = faceColour;
        di.faceOpacity = 1;
        di.edgeOpacity = 1;
        di.edgeWidth = 3;
        di.drawEdges = true;
        di.edgeColour = edgeColour;
        di.precision = 0.001;
        this.cupMesh = await this.bitbybit.draw.drawAnyAsync({ entity: this.cup, options: di }) as Mesh;
        this.cupMesh.parent = this.node;
    }

    downloadStep() {
        this.bitbybit.occt.io.saveShapeSTEP({ shape: this.cup, filename: 'cup.step', adjustYtoZ: false });
    }

    downloadStl() {
        this.occt.io.saveShapeStl({ shape: this.cup, filename: 'cup', precision: 0.001, adjustYtoZ: false });
    }

    mapRange(value, low1, high1, low2, high2) {
        return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
    }
}
