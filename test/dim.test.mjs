// The DIM (Diagram Interchange Model) lane of the wasm build: a model tool
// emits a DIM 0.1 document, renderDim hands it to the engine, and the same
// document always draws the same bytes. See etassia/docs emitter-guide.md.
import test from "node:test";
import assert from "node:assert/strict";
import { renderDim, EtassiaError } from "../dist/index.js";

const personGraph = JSON.stringify({
  dim: "0.1",
  notation: "xsd",
  graph: {
    id: "root",
    layoutOptions: { "elk.algorithm": "layered", "elk.direction": "DOWN" },
    children: [
      {
        id: "type-PersonType", width: 200, height: 110,
        content: [
          { kind: "label", text: "PersonType", role: "title" },
          { kind: "label", text: "name: xs:string", role: "member" },
        ],
      },
      {
        id: "type-AddressType", width: 200, height: 110,
        content: [{ kind: "label", text: "AddressType", role: "title" }],
      },
    ],
    edges: [{
      id: "ref-person-address",
      sources: ["type-PersonType"], targets: ["type-AddressType"],
      style: "association", label: { text: "lives at" },
    }],
  },
});

test("renderDim draws a DIM document to SVG", () => {
  const svg = renderDim(personGraph);
  assert.match(svg, /^<svg/);
  for (const label of ["PersonType", "AddressType", "lives at"]) {
    assert.ok(svg.includes(label), `missing ${label}`);
  }
});

test("the same document draws the same bytes", () => {
  assert.equal(renderDim(personGraph), renderDim(personGraph));
});

test("a foreign DIM version raises Unsupported", () => {
  const foreign = personGraph.replace('"0.1"', '"9.9"');
  assert.throws(() => renderDim(foreign), (e) =>
    e instanceof EtassiaError && e.errorClass === "Unsupported");
});
