#!/usr/bin/env node

/**
 * Integration Test Coverage Collector
 * 
 * Collects code coverage from all running services and aggregates into
 * a comprehensive inter-service integration coverage report.
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createContext } = require('istanbul-lib-report');
const reports = require('istanbul-reports');

// Configuration
const CONFIG = {
  services: [
    {
      name: 'backend',
      containerName: 'backend-integration',
      coveragePath: '/app/coverage',
      sourcePath: '/app/src'
    },
    {
      name: 'frontend',
      containerName: 'frontend-integration',
      coveragePath: '/app/coverage',
      sourcePath: '/app/src'
    },
    {
      name: 'page-scraper',
      containerName: 'page-scraper-integration',
      coveragePath: '/app/coverage',
      sourcePath: '/app/src'
    },
    {
      name: 'version-manager',
      containerName: 'version-manager-integration',
      coveragePath: '/app/coverage',
      sourcePath: '/app'
    }
  ],
  outputDir: '/results',
  aggregatedCoverageDir: '/results/aggregated-coverage',
  reportsDir: '/results/reports'
};

class CoverageCollector {
  constructor() {
    this.coverageMap = createCoverageMap({});
    this.serviceStats = {};
  }

  async collectAll() {
    console.log('🔍 Starting integration test coverage collection...');
    
    await this.ensureDirectories();
    
    for (const service of CONFIG.services) {
      try {
        await this.collectServiceCoverage(service);
      } catch (error) {
        console.warn(`⚠️  Failed to collect coverage for ${service.name}:`, error.message);
        this.serviceStats[service.name] = { error: error.message };
      }
    }
    
    await this.generateAggregatedReports();
    await this.generateSummaryReport();
    
    console.log('✅ Coverage collection completed!');
  }

  async ensureDirectories() {
    await fs.ensureDir(CONFIG.outputDir);
    await fs.ensureDir(CONFIG.aggregatedCoverageDir);
    await fs.ensureDir(CONFIG.reportsDir);
  }

  async collectServiceCoverage(service) {
    console.log(`📊 Collecting coverage for ${service.name}...`);
    
    try {
      // Try to copy coverage from running container first
      await this.extractCoverageFromContainer(service);
    } catch (containerError) {
      console.log(`   Container extraction failed, trying volume mount...`);
      
      // Fallback: Check if coverage is available via volume mount
      await this.extractCoverageFromVolume(service);
    }
    
    // Process the extracted coverage files
    await this.processCoverageFiles(service);
  }

  async extractCoverageFromContainer(service) {
    const { execSync } = require('child_process');
    const tempDir = path.join(CONFIG.outputDir, 'temp', service.name);
    
    await fs.ensureDir(tempDir);
    
    try {
      // Copy coverage files from container
      const copyCommand = `docker cp ${service.containerName}:${service.coveragePath} ${tempDir}`;
      execSync(copyCommand, { stdio: 'pipe' });
      
      console.log(`   ✅ Extracted coverage from container ${service.containerName}`);
      
      // Move coverage files to service directory
      const serviceDir = path.join(CONFIG.aggregatedCoverageDir, service.name);
      await fs.ensureDir(serviceDir);
      
      const coverageFiles = await glob('**/*.json', { cwd: tempDir });
      for (const file of coverageFiles) {
        const srcPath = path.join(tempDir, file);
        const destPath = path.join(serviceDir, file);
        await fs.copy(srcPath, destPath);
      }
      
    } catch (error) {
      console.log(`   Docker copy failed: ${error.message}`);
      throw error;
    } finally {
      // Clean up temp directory
      await fs.remove(tempDir);
    }
  }

  async extractCoverageFromVolume(service) {
    // Check for coverage files in mounted volumes
    const volumePaths = [
      `/coverage/${service.name}`,
      `/app/coverage/${service.name}`,
      path.join(CONFIG.outputDir, service.name, 'coverage')
    ];
    
    let foundCoverage = false;
    
    for (const volumePath of volumePaths) {
      if (await fs.pathExists(volumePath)) {
        console.log(`   ✅ Found coverage in volume: ${volumePath}`);
        
        const serviceDir = path.join(CONFIG.aggregatedCoverageDir, service.name);
        await fs.ensureDir(serviceDir);
        await fs.copy(volumePath, serviceDir);
        
        foundCoverage = true;
        break;
      }
    }
    
    if (!foundCoverage) {
      throw new Error(`No coverage files found for ${service.name}`);
    }
  }

  async processCoverageFiles(service) {
    const serviceDir = path.join(CONFIG.aggregatedCoverageDir, service.name);
    const coverageFiles = await glob('**/coverage-final.json', { cwd: serviceDir });
    
    if (coverageFiles.length === 0) {
      console.log(`   ⚠️  No coverage-final.json found for ${service.name}`);
      return;
    }
    
    let totalFiles = 0;
    let totalStatements = 0;
    let coveredStatements = 0;
    
    for (const coverageFile of coverageFiles) {
      const filePath = path.join(serviceDir, coverageFile);
      const coverageData = await fs.readJson(filePath);
      
      // Merge into global coverage map
      this.coverageMap.merge(coverageData);
      
      // Calculate service-specific stats
      Object.values(coverageData).forEach(fileData => {
        totalFiles++;
        const statements = fileData.s || {};
        Object.values(statements).forEach(count => {
          totalStatements++;
          if (count > 0) coveredStatements++;
        });
      });
    }
    
    const coveragePercent = totalStatements > 0 
      ? ((coveredStatements / totalStatements) * 100).toFixed(2)
      : '0.00';
    
    this.serviceStats[service.name] = {
      files: totalFiles,
      statements: totalStatements,
      covered: coveredStatements,
      coverage: parseFloat(coveragePercent)
    };
    
    console.log(`   📈 ${service.name}: ${coveragePercent}% coverage (${coveredStatements}/${totalStatements} statements)`);
  }

  async generateAggregatedReports() {
    console.log('📊 Generating aggregated coverage reports...');
    
    const context = createContext({
      dir: CONFIG.reportsDir,
      coverageMap: this.coverageMap
    });
    
    // Generate multiple report formats
    const reportTypes = ['html', 'lcov', 'text', 'json'];
    
    for (const type of reportTypes) {
      try {
        const report = reports.create(type, {});
        report.execute(context);
        console.log(`   ✅ Generated ${type} report`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to generate ${type} report:`, error.message);
      }
    }
    
    // Save the final coverage map
    const finalCoveragePath = path.join(CONFIG.reportsDir, 'coverage-final.json');
    await fs.writeJson(finalCoveragePath, this.coverageMap.toJSON(), { spaces: 2 });
  }

  async generateSummaryReport() {
    console.log('📋 Generating integration test coverage summary...');
    
    const summary = {
      timestamp: new Date().toISOString(),
      testType: 'integration',
      services: this.serviceStats,
      aggregated: this.calculateAggregatedStats(),
      reports: {
        html: path.join(CONFIG.reportsDir, 'index.html'),
        lcov: path.join(CONFIG.reportsDir, 'lcov.info'),
        json: path.join(CONFIG.reportsDir, 'coverage-final.json')
      }
    };
    
    // Write summary JSON
    const summaryPath = path.join(CONFIG.reportsDir, 'integration-coverage-summary.json');
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
    
    // Write human-readable summary
    const readableSummary = this.generateReadableSummary(summary);
    const readablePath = path.join(CONFIG.reportsDir, 'COVERAGE_SUMMARY.md');
    await fs.writeFile(readablePath, readableSummary);
    
    console.log('📄 Coverage summary saved to:', readablePath);
    
    // Output summary to console
    console.log('\n' + readableSummary);
  }

  calculateAggregatedStats() {
    const services = Object.values(this.serviceStats).filter(s => !s.error);
    
    if (services.length === 0) {
      return { coverage: 0, files: 0, statements: 0, covered: 0 };
    }
    
    const totals = services.reduce((acc, service) => ({
      files: acc.files + (service.files || 0),
      statements: acc.statements + (service.statements || 0),
      covered: acc.covered + (service.covered || 0)
    }), { files: 0, statements: 0, covered: 0 });
    
    const coverage = totals.statements > 0 
      ? ((totals.covered / totals.statements) * 100)
      : 0;
    
    return {
      coverage: parseFloat(coverage.toFixed(2)),
      ...totals
    };
  }

  generateReadableSummary(summary) {
    const { aggregated, services } = summary;
    
    let report = `# Integration Test Coverage Summary\n\n`;
    report += `**Generated:** ${summary.timestamp}\n`;
    report += `**Test Type:** Integration (Inter-service)\n\n`;
    
    report += `## Overall Coverage\n\n`;
    report += `- **Total Coverage:** ${aggregated.coverage}%\n`;
    report += `- **Files Covered:** ${aggregated.files}\n`;
    report += `- **Statements:** ${aggregated.covered}/${aggregated.statements}\n\n`;
    
    report += `## Service Breakdown\n\n`;
    report += `| Service | Coverage | Files | Statements | Status |\n`;
    report += `|---------|----------|-------|------------|--------|\n`;
    
    Object.entries(services).forEach(([name, stats]) => {
      if (stats.error) {
        report += `| ${name} | N/A | N/A | N/A | ❌ Error: ${stats.error} |\n`;
      } else {
        report += `| ${name} | ${stats.coverage}% | ${stats.files} | ${stats.covered}/${stats.statements} | ✅ |\n`;
      }
    });
    
    report += `\n## Coverage Thresholds\n\n`;
    const thresholds = [
      { name: 'Excellent', min: 90, color: '🟢' },
      { name: 'Good', min: 80, color: '🟡' },
      { name: 'Fair', min: 70, color: '🟠' },
      { name: 'Poor', min: 0, color: '🔴' }
    ];
    
    const threshold = thresholds.find(t => aggregated.coverage >= t.min);
    report += `**Current Status:** ${threshold.color} ${threshold.name} (${aggregated.coverage}%)\n\n`;
    
    report += `## Reports Available\n\n`;
    report += `- **HTML Report:** Open \`${summary.reports.html}\` in a browser\n`;
    report += `- **LCOV Report:** \`${summary.reports.lcov}\`\n`;
    report += `- **JSON Report:** \`${summary.reports.json}\`\n\n`;
    
    report += `## Integration Test Focus\n\n`;
    report += `This coverage report focuses on code paths exercised during inter-service integration testing, including:\n\n`;
    report += `- Backend ↔ Scraper communication\n`;
    report += `- Backend ↔ Version Service communication\n`;
    report += `- Frontend ↔ Backend API communication\n`;
    report += `- Service registration and health checks\n`;
    report += `- End-to-end user workflows\n`;
    report += `- Error handling across service boundaries\n\n`;
    
    if (aggregated.coverage < 70) {
      report += `⚠️  **Coverage below recommended threshold (70%).** Consider adding more integration test scenarios.\n\n`;
    }
    
    return report;
  }
}

// Main execution
async function main() {
  try {
    const collector = new CoverageCollector();
    await collector.collectAll();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Coverage collection failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = CoverageCollector;