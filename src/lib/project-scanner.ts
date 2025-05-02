import * as fs from "fs-extra";
import * as path from "path";
import globby from "globby";
import { ProjectScanResult, ComponentInfo } from "./persrm/types";
import { logger } from "./utils/logger";

/**
 * ProjectScanner - Analyzes project structure and components
 */
export class ProjectScanner {
  /**
   * Scans a project to identify components, dependencies, and structure
   */
  async scanProject(projectPath: string): Promise<ProjectScanResult> {
    logger.info(`Scanning project at ${projectPath}`);

    try {
      // Check if project exists and is a directory
      if (
        !fs.existsSync(projectPath) ||
        !fs.statSync(projectPath).isDirectory()
      ) {
        throw new Error(`Invalid project path: ${projectPath}`);
      }

      // Detect project type
      const projectType = await this.detectProjectType(projectPath);
      logger.info(`Detected project type: ${projectType}`);

      // Identify framework
      const framework = await this.identifyFramework(projectPath);
      logger.info(`Identified framework: ${framework}`);

      // Find components
      const components = await this.findComponents(projectPath, framework);
      logger.info(`Found ${components.length} components`);

      // Get package dependencies
      const dependencies = await this.getDependencies(projectPath);
      logger.info(`Found ${Object.keys(dependencies).length} dependencies`);

      // Get file structure
      const fileStructure = await this.getFileStructure(projectPath);

      return {
        projectPath,
        projectType,
        framework,
        components,
        dependencies,
        fileStructure,
        scannedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Project scan failed:", error);
      throw error;
    }
  }

  /**
   * Detects the type of project (web, mobile, etc.)
   */
  private async detectProjectType(projectPath: string): Promise<string> {
    try {
      // Check for typical files to determine project type
      const hasPackageJson = fs.existsSync(
        path.join(projectPath, "package.json"),
      );
      const hasAndroidFiles = fs.existsSync(path.join(projectPath, "android"));
      const hasIosFiles = fs.existsSync(path.join(projectPath, "ios"));
      const hasElectronInDeps =
        hasPackageJson &&
        JSON.parse(
          fs.readFileSync(path.join(projectPath, "package.json"), "utf8"),
        ).dependencies?.electron;

      if (hasAndroidFiles && hasIosFiles) {
        return "react-native";
      } else if (hasElectronInDeps) {
        return "electron";
      } else if (hasPackageJson) {
        return "web";
      } else {
        return "unknown";
      }
    } catch (error) {
      logger.error("Error detecting project type:", error);
      return "unknown";
    }
  }

  /**
   * Identifies the framework used in the project
   */
  private async identifyFramework(projectPath: string): Promise<string> {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (dependencies.react && dependencies["react-dom"]) {
          return "react";
        } else if (dependencies.vue) {
          return "vue";
        } else if (dependencies.svelte) {
          return "svelte";
        } else if (dependencies.angular || dependencies["@angular/core"]) {
          return "angular";
        } else if (dependencies.next) {
          return "next.js";
        } else if (dependencies.nuxt) {
          return "nuxt.js";
        }
      }

      // If can't determine from package.json, try to find framework files
      const files = await globby(["**/*.{js,jsx,ts,tsx,vue,svelte}"], {
        cwd: projectPath,
        ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
        deep: 2, // Limit depth to avoid searching the entire project
      });

      const fileContents = await Promise.all(
        files.slice(0, 10).map(async (file) => {
          try {
            return await fs.readFile(path.join(projectPath, file), "utf8");
          } catch (err) {
            return "";
          }
        }),
      );

      // Count framework indicators in files
      const indicators = {
        react: 0,
        vue: 0,
        angular: 0,
        svelte: 0,
      };

      fileContents.forEach((content) => {
        if (
          content.includes("import React") ||
          content.includes('from "react"') ||
          content.includes("from 'react'")
        ) {
          indicators.react++;
        }
        if (content.includes("<template>") && content.includes("<script>")) {
          indicators.vue++;
        }
        if (content.includes("@Component") || content.includes("@NgModule")) {
          indicators.angular++;
        }
        if (
          content.includes("<script>") &&
          content.includes("export default {")
        ) {
          indicators.svelte++;
        }
      });

      // Return the framework with the most indicators
      const maxIndicator = Object.entries(indicators).reduce(
        (max, [framework, count]) =>
          count > max.count ? { framework, count } : max,
        { framework: "unknown", count: 0 },
      );

      return maxIndicator.count > 0 ? maxIndicator.framework : "unknown";
    } catch (error) {
      logger.error("Error identifying framework:", error);
      return "unknown";
    }
  }

  /**
   * Finds components in the project
   */
  private async findComponents(
    projectPath: string,
    framework: string,
  ): Promise<ComponentInfo[]> {
    try {
      // Different patterns based on framework
      let patterns: string[] = [];

      switch (framework) {
        case "react":
          patterns = ["**/*.(jsx|tsx)", "**/components/**/*.(js|ts|jsx|tsx)"];
          break;
        case "vue":
          patterns = ["**/*.vue"];
          break;
        case "angular":
          patterns = ["**/*.component.ts"];
          break;
        case "svelte":
          patterns = ["**/*.svelte"];
          break;
        default:
          patterns = ["**/components/**/*.(js|ts|jsx|tsx|vue|svelte)"];
      }

      // Find component files
      const componentFiles = await globby(patterns, {
        cwd: projectPath,
        ignore: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/*.test.*",
          "**/*.spec.*",
          "**/*.stories.*",
        ],
      });

      // Convert to component info
      const components: ComponentInfo[] = await Promise.all(
        componentFiles.slice(0, 100).map(async (file) => {
          try {
            const filePath = path.join(projectPath, file);
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, "utf8");

            // Extract component name from file
            const fileName = path.basename(file).split(".")[0];
            let componentName = fileName;

            // Try to get a better name by parsing the content (simplified)
            if (framework === "react") {
              const funcMatch = content.match(/function\s+([A-Z][a-zA-Z0-9]*)/);
              const constMatch = content.match(
                /const\s+([A-Z][a-zA-Z0-9]*)\s*=/,
              );
              const classMatch = content.match(/class\s+([A-Z][a-zA-Z0-9]*)/);

              componentName =
                funcMatch?.[1] ||
                constMatch?.[1] ||
                classMatch?.[1] ||
                componentName;
            }

            return {
              name: componentName,
              path: file,
              framework,
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
              dependencies: this.extractComponentDependencies(content),
              props: this.extractComponentProps(content, framework),
            };
          } catch (error) {
            logger.warn(`Error analyzing component ${file}:`, error);
            return {
              name: path.basename(file).split(".")[0],
              path: file,
              framework,
              size: 0,
              lastModified: new Date().toISOString(),
              dependencies: [],
              props: [],
            };
          }
        }),
      );

      return components;
    } catch (error) {
      logger.error("Error finding components:", error);
      return [];
    }
  }

  /**
   * Extracts dependencies from component code
   */
  private extractComponentDependencies(content: string): string[] {
    // Simple regex to extract import statements
    const imports =
      content.match(/import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/g) || [];

    return imports
      .map((imp) => {
        const match = imp.match(/['"]([^'"]+)['"]/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
  }

  /**
   * Extracts props from component code
   */
  private extractComponentProps(content: string, framework: string): string[] {
    let props: string[] = [];

    try {
      if (framework === "react") {
        // Extract props from PropTypes
        const propTypesMatch = content.match(
          /([A-Za-z0-9_]+)\.propTypes\s*=\s*{([^}]+)}/,
        );
        if (propTypesMatch) {
          const propTypesStr = propTypesMatch[2];
          props = propTypesStr
            .split(",")
            .map((prop) => prop.trim().split(":")[0].trim())
            .filter(Boolean);
        }

        // Extract props from TypeScript interface
        const interfaceMatch = content.match(
          /interface\s+([A-Za-z0-9_]+)Props\s*{([^}]+)}/,
        );
        if (interfaceMatch) {
          const interfaceStr = interfaceMatch[2];
          props = interfaceStr
            .split(";")
            .map((prop) => prop.trim().split(":")[0].split("?")[0].trim())
            .filter(Boolean);
        }
      } else if (framework === "vue") {
        // Extract props from Vue props definition
        const propsMatch = content.match(/props\s*:\s*{([^}]+)}/);
        if (propsMatch) {
          const propsStr = propsMatch[1];
          props = propsStr
            .split(",")
            .map((prop) => prop.trim().split(":")[0].trim())
            .filter(Boolean);
        }
      }
    } catch (error) {
      logger.warn("Error extracting props:", error);
    }

    return props;
  }

  /**
   * Gets dependencies from package.json
   */
  private async getDependencies(
    projectPath: string,
  ): Promise<Record<string, string>> {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf8"),
        );
        return { ...packageJson.dependencies, ...packageJson.devDependencies };
      }

      return {};
    } catch (error) {
      logger.error("Error getting dependencies:", error);
      return {};
    }
  }

  /**
   * Gets the file structure of the project
   */
  private async getFileStructure(projectPath: string): Promise<any> {
    try {
      // This is a simplified version - in a real implementation,
      // you'd want to build a proper tree structure
      const files = await globby(["**/*"], {
        cwd: projectPath,
        ignore: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/.git/**",
        ],
        onlyFiles: false,
        deep: 3, // Limit depth to avoid huge output
      });

      // Create a hierarchical structure
      const structure: Record<string, any> = {};

      files.forEach((file) => {
        const parts = file.split("/");
        let current = structure;

        parts.forEach((part, index) => {
          if (!current[part]) {
            current[part] = {};
          }

          current = current[part];
        });
      });

      return structure;
    } catch (error) {
      logger.error("Error getting file structure:", error);
      return {};
    }
  }
}
