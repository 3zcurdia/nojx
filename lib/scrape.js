export function validateSelectors(selectors) {
  if (!selectors || typeof selectors !== "object" || Array.isArray(selectors)) {
    throw new Error("Selectors must be a non-empty object");
  }

  const keys = Object.keys(selectors);
  if (keys.length === 0) {
    throw new Error("Selectors must be a non-empty object");
  }

  for (const [key, spec] of Object.entries(selectors)) {
    validateSpec(key, spec);
  }
}

function validateSpec(path, spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error(`Selector "${path}" must be an object`);
  }

  if (!spec.css || typeof spec.css !== "string" || spec.css.trim() === "") {
    throw new Error(`Selector "${path}" requires a "css" string`);
  }

  if (
    spec.type !== undefined &&
    spec.type !== "value" &&
    spec.type !== "list"
  ) {
    throw new Error(
      `Selector "${path}" has invalid type "${spec.type}" (expected "value" or "list")`,
    );
  }

  if (spec.value !== undefined && typeof spec.value !== "string") {
    throw new Error(`Selector "${path}" has invalid "value" (expected string)`);
  }

  if (spec.attr !== undefined && typeof spec.attr !== "string") {
    throw new Error(`Selector "${path}" has invalid "attr" (expected string)`);
  }

  if (spec.fields !== undefined) {
    if (
      !spec.fields ||
      typeof spec.fields !== "object" ||
      Array.isArray(spec.fields)
    ) {
      throw new Error(
        `Selector "${path}" has invalid "fields" (expected object)`,
      );
    }

    const fieldKeys = Object.keys(spec.fields);
    if (fieldKeys.length === 0) {
      throw new Error(`Selector "${path}" has empty "fields" object`);
    }

    for (const [fieldKey, fieldSpec] of Object.entries(spec.fields)) {
      validateSpec(`${path}.${fieldKey}`, fieldSpec);
    }
  }
}

export async function scrapeData(page, selectors) {
  validateSelectors(selectors);

  return await page.evaluate((defs) => {
    function getValue(el, spec) {
      const v = spec.value !== undefined ? spec.value : "text";

      if (typeof v === "string" && v.startsWith("attr:")) {
        const name = v.slice(5);
        return el.getAttribute(name);
      }

      if (v === "attr") {
        if (spec.attr) {
          return el.getAttribute(spec.attr);
        }
        return null;
      }

      if (v === "html") {
        return el.innerHTML;
      }

      if (v === "value") {
        // for input/select/textarea
        if (el.value !== undefined) {
          return el.value;
        }
        return el.getAttribute("value");
      }

      // default "text"
      return (el.textContent || "").trim();
    }

    function scrapeField(root, spec) {
      const type = spec.type || "value";
      const hasFields =
        spec.fields &&
        typeof spec.fields === "object" &&
        !Array.isArray(spec.fields);

      if (hasFields) {
        if (type === "list") {
          const parents = Array.from(root.querySelectorAll(spec.css));
          return parents.map((parent) => {
            const obj = {};
            for (const [k, childSpec] of Object.entries(spec.fields)) {
              obj[k] = scrapeField(parent, childSpec);
            }
            return obj;
          });
        } else {
          const parent = root.querySelector(spec.css);
          if (!parent) return null;
          const obj = {};
          for (const [k, childSpec] of Object.entries(spec.fields)) {
            obj[k] = scrapeField(parent, childSpec);
          }
          return obj;
        }
      } else {
        if (type === "list") {
          const els = Array.from(root.querySelectorAll(spec.css));
          return els.map((el) => getValue(el, spec));
        } else {
          const el = root.querySelector(spec.css);
          if (!el) return null;
          return getValue(el, spec);
        }
      }
    }

    const result = {};
    for (const [key, spec] of Object.entries(defs)) {
      result[key] = scrapeField(document, spec);
    }
    return result;
  }, selectors);
}
