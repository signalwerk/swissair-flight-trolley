const slices = [];
const count = 8;
const offset = 20;
const lowResolution = false;

const interpolationSteps = lowResolution ? 6 : 8;
const resolutionShape = lowResolution ? 18 : 36;

const sizeL = {
  w: 16.5,
  h: 10,
  order: 2.6,
};

const sizeS = {
  w: 11,
  h: 10.5,
  order: 2.2,
};

const sizeEnd = {
  w: sizeL.w - 1,
  h: sizeL.h - 1,
  order: 2.6,
  offset: 1,
};

// see https://easings.net/#

function easeInQuartT(x) {
  return x * x * x * x;
}

function easeInQuart(start, end, t) {
  const time = easeInQuartT(t);
  return linear(start, end, time);
}

function easeOutQuartT(x) {
  return 1 - Math.pow(1 - x, 4);
}

function easeOutQuart(start, end, t) {
  const time = easeOutQuartT(t);
  return linear(start, end, time);
}

function easeInOutQuad(start, end, t) {
  const time = easeInOutQuadT(t);
  return linear(start, end, time);
}

function easeInOutQuadT(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function linear(start, end, time) {
  return start * (1 - time) + end * time;
}

function interpolatePoint(point0, point1, t, fn = easeInOutQuad) {
  const [x0, y0, z0] = point0;
  const [x1, y1, z1] = point1;
  return [fn(x0, x1, t), fn(y0, y1, t), linear(z0, z1, t)];
}

function interpolatePolygon(
  points0,
  points1,
  interpolationSteps,
  fn = easeInOutQuad
) {
  const resultPolygons = [];

  for (let step = 1; step < interpolationSteps; step++) {
    const resultPolygon = [];

    points0.forEach((point0, i) => {
      const newPoint = interpolatePoint(
        point0,
        points1[i],
        (1 / (interpolationSteps - 1)) * step,
        fn
      );
      resultPolygon.push(newPoint);
    });
    resultPolygons.push(resultPolygon);
  }

  return resultPolygons;
}

function createPolyCircle(radius = 1, z = 0) {
  const resolutino = 4;

  return Array.from({ length: resolutino }, (_, i) => {
    const x =
      radius * Math.cos(((360 / resolutino) * i + -90) * (Math.PI / 180));
    const y =
      radius * Math.sin(((360 / resolutino) * i + -90) * (Math.PI / 180));
    return [Math.round(x), Math.round(y), z];
  });
}

function createPoly(dimension, z) {
  // return createPolyCircle(dimension.w, z);
  return SuperEllipse(
    0,
    0,
    z,
    dimension.w,
    dimension.h,
    resolutionShape,
    dimension.order
  );
}

const pointsL0 = createPoly(sizeL, 0);
const pointsS0 = createPoly(sizeS, offset / 2);
const pointsS1 = createPoly(sizeS, 0);
const pointsL1 = createPoly(sizeL, offset / 2);

const interpolatedPointsLtoS = interpolatePolygon(
  pointsL0,
  pointsS0,
  interpolationSteps
);
const interpolatedPointsStoL = interpolatePolygon(
  pointsS1,
  pointsL1,
  interpolationSteps
);

const pointsEnd = createPoly(sizeEnd, 0 - sizeEnd.offset);

// since we skip each first element we need to add it at the beginning
const firstSegment = [
  pointsEnd,
  ...interpolatePolygon(pointsEnd, pointsL0, interpolationSteps, easeOutQuart),
].map((item) => Polygon(item, true));

const endPointZ = (offset / 2) * count;

const lastSegment = interpolatePolygon(
  createPoly(sizeL, endPointZ),
  createPoly(sizeEnd, endPointZ + sizeEnd.offset),
  interpolationSteps,
  easeInQuart
).map((item) => Polygon(item, true));

slices.push(...firstSegment);

for (let i = 0; i < count; i++) {
  if (i % 2 === 0) {
    slices.push(
      ...interpolatedPointsLtoS.map((item) =>
        Translate([0, 0, (offset * i) / 2], Polygon(item, true))
      )
    );
  } else {
    slices.push(
      ...interpolatedPointsStoL.map((item) =>
        Translate([0, 0, (offset * i) / 2], Polygon(item, true))
      )
    );
  }
}

slices.push(...lastSegment);

LoftSH(slices, true);

// Loft a solid shape through the cross sections
function LoftSH(wires, keepWires) {
  let curLoft = CacheOp(arguments, () => {
    let pipe = new oc.BRepOffsetAPI_ThruSections(true, true);

    // Construct a Loft that passes through the wires
    wires.forEach((wire) => {
      pipe.AddWire(wire);
    });

    // pipe.Build();
    return pipe.Shape();
    // return new oc.TopoDS_Shape(pipe.Shape());
  });

  wires.forEach((wire) => {
    if (!keepWires) {
      sceneShapes = Remove(sceneShapes, wire);
    }
  });
  sceneShapes.push(curLoft);
  return curLoft;
}

// Return the value of the first parameter and the sign of the second parameter
function copysign(x, y) {
  return Math.sign(y) === 1 ? Math.abs(x) : -Math.abs(x);
}

// Returns x to the power y, but preserves the sign of x
// This allows us to plot all four quadrants with a single loop and
// no additional sign logic
function signed_power(x, y) {
  return copysign(Math.pow(Math.abs(x), y), x);
}

// Draws the super ellipse
// https://github.com/winwaed/superellipse/blob/master/SuperEllipse.py
// cx,cy - Center coordinate for the super ellipse
// diax,diay - Diameter (x,y) for the super ellipse
// npnts  - Number of points to use (greater => more accurate shape)
// order - Order of Super Ellipse. 2=Ellipse. >2 for a super ellipse
function SuperEllipse(cx, cy, cz, diax, diay, npnts, order) {
  const pnts = [];
  const power = 2.0 / order;
  const theta = (Math.PI * 2.0) / npnts;
  const radiusx = diax / 2.0;
  const radiusy = diay / 2.0;

  for (let i = 0; i < npnts; i++) {
    x = cx + radiusx * signed_power(Math.cos(i * theta), power);
    y = cy + radiusy * signed_power(Math.sin(i * theta), power);
    pnts.push([x, y, cz]);
  }

  return pnts;
}
