const {
  rootPackageName,
  findPackageJson,
  isRelativeImport,
  getShortPackageName,
  getPackageNameFromPath,
  findConfigByPackageName,
  findInternalPackageNames,
  reportLayerBreakingImport,
} = require("./utils");

const { packageMap } = findInternalPackageNames();

module.exports.rules = {
  "code-layering": {
    meta: {
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            target: { type: "string" },
            allow: { type: "array" },
            restrict: { type: "array" },
          },
          required: ["target"],
        },
        minItems: 1,
      },
    },
    create: function (context) {
      // root of package of current file
      const packagePath = findPackageJson(context.getFilename());

      // get name of package
      const currentPackageName = packageMap.get(packagePath);

      const { allow, restrict } = findConfigByPackageName(
        context,
        currentPackageName
      );

      return {
        ImportDeclaration(node) {
          const importPath = node.source.value;

          // check if its an internal package
          if (!importPath.includes(rootPackageName)) {
            return;
          }

          if (isRelativeImport(importPath)) {
            handleRelativeImport(context, node, currentPackageName, importPath);
          } else {
            handleAbsoluteImport({
              context,
              node,
              currentPackageName,
              allow,
              restrict,
              importPath,
            });
          }
        },
      };
    },
  },
};

/**
 * Handles a relative import by checking if it breaks layers.
 * @param {Object} context - The ESLint context.
 * @param {Object} node - The import node.
 * @param {string} currentPackageName - The current package name.
 * @param {string} importPath - The import path.
 */
function handleRelativeImport(context, node, currentPackageName, importPath) {
  const importedPackageName = getPackageNameFromPath(
    importPath,
    context.getFilename()
  );
  if (importedPackageName !== currentPackageName) {
    // check if the package is allowed but the import is just relative
    // or if not allowed at all
    reportLayerBreakingImport(
      context,
      node,
      "Layer-breaking relative import detected"
    );
  }
}

/**
 * Handles an absolute import by checking if it breaks layers.
 * @param {Object} options - Options object.
 * @param {Object} options.context - The ESLint context.
 * @param {Object} options.node - The import node.
 * @param {string} options.currentPackageName - The current package name.
 * @param {string[]} options.allow - The list of allowed packages.
 * @param {string[]} options.restrict - The list of restricted packages.
 * @param {string} options.importPath - The import path.
 */
function handleAbsoluteImport(options) {
  const { context, node, currentPackageName, allow, restrict, importPath } =
    options;

  const shortImportPackageName = getShortPackageName(importPath);
  const shortCurrentPackageName = getShortPackageName(currentPackageName);
  const allowed = allow.some(
    (packageName) =>
      packageName === "*" || packageName === shortImportPackageName
  );

  if (!allowed) {
    reportLayerBreakingImport(
      context,
      node,
      `Layer-breaking: "${shortImportPackageName}" is not in allow-list of "${shortCurrentPackageName}"`
    );
    return;
  }

  // restrict
  for (const packageName of restrict) {
    if (packageName === shortImportPackageName) {
      return reportLayerBreakingImport(
        context,
        node,
        `Layer-breaking: "${shortCurrentPackageName}" is restricted from importing "${packageName}"`
      );
    }
  }
}
