const fs = require("fs");
const path = require("path");

const { name: rootPackageName } = require(path.join(
  process.cwd(),
  "package.json"
));

/**
 * Gets the package name from an import path.
 * @param {string} importPath - The import path to parse.
 * @param {string} currentFilePath - The current file's path.
 * @returns {string|null} The package name or null if not found.
 */
function getPackageNameFromPath(importPath, currentFilePath) {
  const normalizedPath = path.normalize(importPath);
  const pathSegments = normalizedPath.split("/");
  const packageNameSegment = pathSegments.find((segment) => {
    return segment !== ".." && segment !== "." && segment !== "";
  });

  if (!packageNameSegment) {
    return null;
  }

  const rootDirectory = process.cwd(); // Current working directory

  const packageJsonPath = path.join(
    rootDirectory,
    packageNameSegment,
    "package.json"
  );

  try {
    const packageJsonData = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonData);
    return packageJson.name || null;
  } catch (error) {
    return null;
  }
}

/**
 * Finds the configuration for a package by its name.
 * @param {Object} context - The ESLint context.
 * @param {string} currentPackageName - The current package name.
 * @returns {Object} The package configuration object.
 */
function findConfigByPackageName(context, currentPackageName) {
  const shortPackageName = getShortPackageName(currentPackageName);

  const packageConfig = context.options.find(({ target }) => {
    return shortPackageName === target;
  }) ?? {
    target: shortPackageName,
    allow: ["*"],
    restrict: [],
  }; // or create or that there should be a config

  return packageConfig;
}

/**
 * Checks if an import path is relative.
 * @param {string} importPath - The import path to check.
 * @returns {boolean} True if the import path is relative, false otherwise.
 */
function isRelativeImport(importPath) {
  return importPath.includes("..");
}

/**
 * Extracts the short package name from the current package name.
 * @param {string} currentPackageName - The current package name.
 * @returns {string} The short package name.
 */
function getShortPackageName(currentPackageName) {
  return currentPackageName.replace(`@${rootPackageName}/`, "");
}

/**
 * Finds and maps internal package names within the current working directory.
 * @returns {Object} An object containing a Map of package directories to package names.
 */
function findInternalPackageNames() {
  const rootDirectory = process.cwd(); // Current working directory

  const packageMap = new Map();

  /**
   * Recursively traverses a directory to find package.json files and map them to their respective directories.
   * @param {string} dir - The directory to start the traversal from.
   */
  function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (file !== "node_modules") {
          traverse(fullPath);
        }
      } else if (file === "package.json") {
        const packageJsonPath = fullPath;
        const packageJson = require(packageJsonPath);
        const packageName = packageJson.name;
        packageMap.set(dir, packageName);
      }
    }
  }

  traverse(rootDirectory);

  return { packageMap };
}

/**
 * Finds the nearest directory containing a package.json file based on the provided file path.
 * @param {string} filePath - The file path from which to start the search.
 * @returns {string|null} The directory path containing package.json, or null if not found.
 */
function findPackageJson(filePath) {
  let currentDir = path.dirname(filePath);

  while (currentDir !== "/") {
    const packageJsonPath = path.join(currentDir, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }

    // Go up one directory
    currentDir = path.dirname(currentDir);
  }

  // If no package.json is found, return null
  return null;
}

/**
 * Reports a layer-breaking import with a specified message.
 * @param {Object} context - The ESLint context.
 * @param {Object} node - The import node.
 * @param {string} message - The error message.
 */
function reportLayerBreakingImport(context, node, message) {
  context.report({
    node,
    message: `🚨 ${message} 🚨`,
  });
}

module.exports = {
  rootPackageName,
  findPackageJson,
  isRelativeImport,
  getShortPackageName,
  getPackageNameFromPath,
  findConfigByPackageName,
  findInternalPackageNames,
  reportLayerBreakingImport,
};
