import { Point } from './Point';
import { Wire } from './Wire';
import { isNull } from 'util';

/**
 * Abstract Class Circuit Elements
 * Inherited by Each Circuit Component
 */
export abstract class CircuitElement {
  /**
   * Circuit Component Name
   */
  public keyName: string;
  /**
   * Stores the id of the Component
   */
  public id: number;
  /**
   * Stores the Nodes of a Component
   */
  public nodes: Point[] = [];
  /**
   * Raphael Set of elements
   */
  public elements: any;
  /**
   * Translation X
   */
  public tx = 0;
  /**
   * Translation Y
   */
  public ty = 0;
  /**
   * Title of the component
   */
  public title: string;
  /**
   * Store Values That are required during simulation
   */
  public simulationData: any = {};
  /**
   * Store Values that are additionaly require by class
   */
  public data: any = {};
  /**
   * Stores Information regarding a component
   */
  public info: any;
  /**
   * The Half Size of the Circuit Node
   */
  public pointHalf: number;
  /**
   * Node ID
   */
  public nid = 0;
  /**
   * Constructor For Circuit Element Class (Parent of every component)
   * @param keyName KeyName For a Component required for mapping class to string
   * @param x X position of component
   * @param y Y Position Of component
   * @param filename Json Data filename
   * @param canvas Raphael Canvas
   */
  constructor(keyName: string, public x: number, public y: number, filename: string = '', canvas: any = null) {
    this.id = Date.now(); // Generate New id
    this.keyName = keyName; // Set key name
    // Create Raphael Set
    this.elements = window['canvas'].set();

    // if filename is present fetch the file
    if (filename) {
      fetch(`./assets/jsons/${filename}`)
        .then(v => v.json())
        .then(obj => {
          // get the title
          this.title = obj.name;

          this.pointHalf = obj.pointHalf;
          // Draw Elements of the component

          this.DrawElement(canvas, obj.draw);
          // Add Circuiy Nodes
          this.DrawNodes(canvas, obj.pins, obj.pointHalf);
          // Add info and data
          this.info = obj.info;
          this.data = obj.data;
          // Add a Drag listener
          this.setDragListeners();
          // Add a Click Listener
          this.setClickListener(null);
          // Add Hover Listener
          this.setHoverListener();
          // Translate the elements to the tranformation
          this.elements.transform(`t${this.tx},${this.ty}`);
          // Move the node according to the translatiom
          for (const node of this.nodes) {
            node.relativeMove(this.tx, this.ty);
          }
          // Decrease the Queue
          window['queue'] -= 1;
          // Call the init method
          this.init();
        })
        .catch(err => {
          console.error(err);
          window['showToast']('Failed to load');
          // TODO: Delete the Component
        });
    }
  }
  /**
   * Draws circuit nodes
   * @param canvas Raphael Canvas
   * @param pinData Pin Position and name
   * @param pointHalf The Half size of circuit node
   */
  DrawNodes(canvas: any, pinData: any, pointHalf: number) {
    for (const pin of pinData) {
      this.nodes.push(
        new Point(
          canvas,
          this.x + pin.x,
          this.y + pin.y,
          pin.name,
          pointHalf,
          this
        )
      );
    }
  }
  /**
   * Draw Elements inside an component
   * @param canvas Raphael Canvas
   * @param drawData Draw Data
   */
  DrawElement(canvas: any, drawData: any) {
    for (const item of drawData) {
      // Draw image
      if (item.type === 'image') {
        this.elements.push(
          canvas.image(
            item.url,
            this.x + item.x,
            this.y + item.y,
            item.width,
            item.height
          )
        );
      } else if (item.type === 'path') {
        this.elements.push(
          this.DrawPath(canvas, item)
        );
      } else if (item.type === 'rectangle') {
        // Draw rectangle
        this.elements.push(
          canvas.rect(
            this.x + item.x,
            this.y + item.y,
            item.width,
            item.height,
            item.radius || 0
          ).attr({
            fill: item.fill || 'none',
            stroke: item.stroke || 'none'
          })
        );
      } else if (item.type === 'circle') {
        // Draw a circle
        this.elements.push(
          canvas.circle(
            this.x + item.x,
            this.y + item.y,
            item.radius,
          ).attr({
            fill: item.fill || 'none',
            stroke: item.stroke || 'none'
          })
        );
      } else if (item.type === 'polygon') {
        this.DrawPolygon(canvas, item);
      }
    }
  }
  /**
   * Draws an Polygon
   * @param canvas Raphael Paper(Canvas)
   * @param item Polygon points in a 2d array format
   */
  DrawPolygon(canvas: any, item: any) {
    if (item.points.length <= 1) {
      return;
    }
    const points = item.points;
    let tmp = 'M';
    for (const point of points) {
      tmp += `${this.x + point[0]},${this.y + point[1]}L`;
    }
    tmp = tmp.substr(0, tmp.length - 1) + 'z';
    this.elements.push(
      canvas.path(tmp)
        .attr({
          fill: item.fill || 'none',
          stroke: item.stroke || 'none'
        })
    );
  }
  /**
   * Draw a Path
   * @param canvas Raphael Paper (Canvas)
   * @param item Path Data
   */
  DrawPath(canvas: any, item: any) {
    // Regex used to parse the path data
    const lines = /L[\-]?\d+(\.\d*)?\,[\-]?\d+(\.\d*)?/g; // L a,b
    const start = /M[\-]?\d+(\.\d*)?\,[\-]?\d+(\.\d*)?/g; // M a,b
    const curves = /C([\-]?\d+(\.\d*)?\,){5}[\-]?\d+(\.\d*)?/g;
    const horizontal = /H[\-]?\d+(\.\d*)?/g; // H a
    const vertical = /V[\-]?\d+(\.\d*)?/g; // V b
    const sCurve = /S([\-]?\d+(\.\d*)?\,){3}[\-]?\d+(\.\d*)?/g;
    let str: string = item.value;

    str = this.calcRelative(str, start, canvas);
    str = this.calcRelative(str, lines, canvas);
    str = this.calcRelative(str, curves, canvas);
    str = this.calcRelative(str, horizontal, canvas);
    str = this.calcRelative(str, vertical, canvas);
    str = this.calcRelative(str, sCurve, canvas);
    this.elements.push(
      canvas.path(str)
        .attr({
          fill: item.fill || 'none',
          stroke: item.stroke || 'none'
        })
    );
  }
  /**
   * Draw path relative to the component
   * @param input Path Data
   * @param pattern The regex pattern
   * @param canvas Raphael Paper
   */
  calcRelative(input: string, pattern: RegExp, canvas: any) {
    const founds = input.match(pattern);
    if (founds) {
      for (const found of founds) {
        let output = '';
        const start = found.charAt(0);
        let tmp: any = found.substring(1).split(',');
        tmp = tmp.map(v => parseFloat(v));
        if (start === 'M' || start === 'L') {
          output += `${start}${this.x + tmp[0]},${this.y + tmp[1]}`;
        } else if (start === 'V') {
          output += `${start}${this.y + tmp[0]}`;
        } else if (start === 'H') {
          output += `${start}${this.x + tmp[0]}`;
        } else if (start === 'C') {
          output += `${start}${this.x + tmp[0]},`;
          output += `${this.y + tmp[1]},`;
          output += `${this.x + tmp[2]},`;
          output += `${this.y + tmp[3]},`;
          output += `${this.x + tmp[4]},`;
          output += `${this.y + tmp[5]}`;
        } else if (start === 'S') {
          output += `${start}${this.x + tmp[0]},`;
          output += `${this.y + tmp[1]},`;
          output += `${this.x + tmp[2]},`;
          output += `${this.y + tmp[3]},`;
        }
        input = input.replace(found, output);
      }
    }
    return input;
  }
  /**
   * Add Drag listener to the components
   */
  setDragListeners() {
    // let tmpx = 0;
    // let tmpy = 0;
    let fdx = 0;
    let fdy = 0;
    let tmpar = [];
    this.elements.drag((dx, dy) => {
      this.elements.transform(`t${this.tx + dx},${this.ty + dy}`);
      // tmpx = this.tx + dx;
      // tmpy = this.ty + dy;
      fdx = dx;
      fdy = dy;
      for (let i = 0; i < this.nodes.length; ++i) {
        this.nodes[i].move(tmpar[i][0] + dx, tmpar[i][1] + dy);
      }
    }, () => {
      fdx = 0;
      fdy = 0;
      tmpar = [];
      for (const node of this.nodes) {
        // node.remainHidden();
        tmpar.push(
          [node.x, node.y]
        );
      }
    }, () => {
      // for (const node of this.nodes) {
      //   node.relativeMove(fdx, fdy);
      //   node.remainShow();
      // }
      this.tx += fdx;
      this.ty += fdy;
    });
  }
  /**
   * Add Hover Listener
   */
  setHoverListener() {
    // this.elements.mouseover(() => {
    //   for (const node of this.nodes) {
    //     // node.show();
    //   }
    // });
    // this.elements.mouseout(() => {
    //   for (const node of this.nodes) {
    //     // node.hide();
    //   }
    // });
  }
  /**
   * Add a Click listenert to component and show properties on click
   * @param callback On Click Callback
   */
  setClickListener(callback: () => void) {
    this.elements.mousedown(() => {
      if (window['Selected'] && (window['Selected'] instanceof Wire)) {
        if ((isNull(window['Selected'].start) || isNull(window['Selected'].end))) {
          return;
        }
        window['Selected'].deselect();
      }
      window['isSelected'] = true;
      window['Selected'] = this;
      window['showProperty'](() => this.properties());
      if (callback) {
        callback();
      }
    });
  }
  /**
   * Initialize Variable after inheriting this function
   */
  init() { }

  /**
   * Save Circuit Component
   */
  save(): any {
    const data = this.SaveData();
    const ret = {
      x: this.x,
      y: this.y,
      tx: this.tx,
      ty: this.ty,
      id: this.id
    };
    if (data) {
      ret['data'] = data;
    }
    return ret;
  }
  /**
   * The Additional data that needs to be saved inside database.
   * After Inheriting return the Data Object
   */
  SaveData() {
    return null;
  }
  /**
   * Load Circuit Component
   */
  load(data: any): void {
    this.id = data.id;
    this.tx = data.tx;
    this.ty = data.ty;
    this.LoadData(data);
  }
  /**
   * The additional data which is stored in database needs to be load.
   * Inherit this function for loading additional data.
   * @param data Data from Database
   */
  LoadData(data: any) { }
  /**
   * Returns the Circuit Node based on the x,y Position
   */
  getNode(x: number, y: number, id: number = null): Point {
    for (const node of this.nodes) {
      if (
        (Math.floor(node.x + this.pointHalf) === Math.floor(x) &&
          Math.floor(node.y + this.pointHalf) === Math.floor(y))
        ||
        node.id === id
      ) {
        return node;
      }
    }
    return null;
  }
  /**
   * Removes Component from Canvas and memory
   */
  remove(): void {
    this.elements.remove();
    for (const n of this.nodes) {
      n.remove();
    }
    this.delete();
  }
  /**
   * Inherit this function to remove some variable
   */
  delete() { }
  /**
   * Return the Name of the component.Can be inheriter to return custom name.
   */
  getName() { return this.title; }
  /**
   * Return the Property of the Circuit Component
   * @returns Object containing component name,id and the html required to be shown on property box
   */
  abstract properties(): { keyName: string, id: number, body: HTMLElement, title: string };
  /**
   * Initialize variable required for simulation
   * Called before simulation
   */
  abstract initSimulation(): void;
  /**
   * Called when Stop Simulation
   */
  abstract closeSimulation(): void;
}
