import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Gets the version from the package.json file
 */
export function getPackageVersion(): string {
  try {
    // Try to find package.json in the current directory
    const packagePath = path.resolve(__dirname, '../../../package.json');
    
    if (fs.existsSync(packagePath)) {
      const packageJson = fs.readJsonSync(packagePath);
      return packageJson.version || '0.1.0';
    }
    
    // If not found, return a default version
    return '0.1.0';
  } catch (error) {
    console.error('Error reading package.json:', error);
    return '0.1.0';
  }
}

/**
 * Gets the name from the package.json file
 */
export function getPackageName(): string {
  try {
    // Try to find package.json in the current directory
    const packagePath = path.resolve(__dirname, '../../../package.json');
    
    if (fs.existsSync(packagePath)) {
      const packageJson = fs.readJsonSync(packagePath);
      return packageJson.name || 'persrm';
    }
    
    // If not found, return a default name
    return 'persrm';
  } catch (error) {
    console.error('Error reading package.json:', error);
    return 'persrm';
  }
}

/**
 * Gets a dependency version from the package.json file
 */
export function getDependencyVersion(dependencyName: string): string | null {
  try {
    // Try to find package.json in the current directory
    const packagePath = path.resolve(__dirname, '../../../package.json');
    
    if (fs.existsSync(packagePath)) {
      const packageJson = fs.readJsonSync(packagePath);
      
      // Check in dependencies, devDependencies, and peerDependencies
      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};
      const peerDependencies = packageJson.peerDependencies || {};
      
      return dependencies[dependencyName] || 
             devDependencies[dependencyName] || 
             peerDependencies[dependencyName] || 
             null;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading package.json:', error);
    return null;
  }
} 