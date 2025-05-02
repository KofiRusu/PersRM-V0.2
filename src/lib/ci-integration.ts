import * as path from "path";
import * as fs from "fs-extra";
import axios from "axios";
import { logger } from "./utils/logger";

/**
 * Options for publishing a report to CI
 */
interface PublishReportOptions {
  reportPath: string;
  provider: "github" | "gitlab" | "azure-devops";
  token: string;
  repository?: string;
  prNumber?: number;
  commentOnPR?: boolean;
}

/**
 * CI Integration - Handles integration with CI systems
 */
export class CIIntegration {
  /**
   * Publishes a report to CI
   */
  async publishReport(options: PublishReportOptions): Promise<boolean> {
    logger.info(`Publishing report to ${options.provider}`);

    try {
      // Validate options
      if (!options.reportPath) {
        throw new Error("Report path is required");
      }

      if (!options.token) {
        throw new Error("CI token is required");
      }

      // Check that report exists
      if (!fs.existsSync(options.reportPath)) {
        throw new Error(`Report not found at path: ${options.reportPath}`);
      }

      // Publish to provider
      switch (options.provider) {
        case "github":
          return await this.publishToGitHub(options);
        case "gitlab":
          return await this.publishToGitLab(options);
        case "azure-devops":
          return await this.publishToAzureDevOps(options);
        default:
          throw new Error(`Unsupported CI provider: ${options.provider}`);
      }
    } catch (error) {
      logger.error("Error publishing report:", error);
      return false;
    }
  }

  /**
   * Publishes a report to GitHub
   */
  private async publishToGitHub(
    options: PublishReportOptions,
  ): Promise<boolean> {
    try {
      // Extract repo info from options or git
      const repository =
        options.repository || (await this.detectGitHubRepository());

      if (!repository) {
        throw new Error(
          "GitHub repository not specified and could not be detected",
        );
      }

      // If we're supposed to comment on a PR and have a PR number
      if (options.commentOnPR && options.prNumber) {
        // Generate report summary
        const reportSummary = await this.generateReportSummary(
          options.reportPath,
        );

        // Create a comment on the PR
        const apiUrl = `https://api.github.com/repos/${repository}/issues/${options.prNumber}/comments`;

        await axios.post(
          apiUrl,
          {
            body: reportSummary,
          },
          {
            headers: {
              Authorization: `token ${options.token}`,
              Accept: "application/vnd.github.v3+json",
            },
          },
        );

        logger.info(
          `Successfully published report to GitHub PR #${options.prNumber}`,
        );
        return true;
      } else {
        // For now, just log a message
        logger.info(
          "No PR number provided or commenting disabled. Report not published to GitHub.",
        );
        return false;
      }
    } catch (error) {
      logger.error("Error publishing to GitHub:", error);
      return false;
    }
  }

  /**
   * Publishes a report to GitLab
   */
  private async publishToGitLab(
    options: PublishReportOptions,
  ): Promise<boolean> {
    // This is a stub - would implement similar logic to GitHub
    logger.info("GitLab integration not yet implemented");
    return false;
  }

  /**
   * Publishes a report to Azure DevOps
   */
  private async publishToAzureDevOps(
    options: PublishReportOptions,
  ): Promise<boolean> {
    // This is a stub - would implement similar logic to GitHub
    logger.info("Azure DevOps integration not yet implemented");
    return false;
  }

  /**
   * Attempts to detect the GitHub repository from git config
   */
  private async detectGitHubRepository(): Promise<string | null> {
    try {
      // This is a simplified implementation
      // In a real-world scenario, you would use a Git library or shell commands
      // to extract the remote origin URL and parse it
      return null;
    } catch (error) {
      logger.error("Error detecting GitHub repository:", error);
      return null;
    }
  }

  /**
   * Generates a summary of the report for inclusion in PR comments
   */
  private async generateReportSummary(reportPath: string): Promise<string> {
    try {
      const reportExt = path.extname(reportPath).toLowerCase();

      if (reportExt === ".json") {
        // For JSON reports, parse and extract key metrics
        const reportData = await fs.readJSON(reportPath);

        let summary = "## PersRM Analysis Report\n\n";

        if (reportData.summary) {
          const { summary: reportSummary } = reportData;

          summary += `### Overview\n`;
          summary += `- **Score**: ${reportSummary.overallScore}/${reportSummary.maxScore}\n`;
          summary += `- **Analyzed at**: ${new Date(reportSummary.timestamp).toLocaleString()}\n`;
          summary += `- **Issues Found**: ${reportSummary.issues?.length || 0}\n\n`;

          if (reportSummary.phases?.length > 0) {
            summary += "### Phase Scores\n";

            reportSummary.phases.forEach((phase: any) => {
              summary += `- **${phase.phase}**: ${phase.score}/${phase.maxScore}\n`;
            });

            summary += "\n";
          }

          // Include top issues
          if (reportSummary.issues?.length > 0) {
            summary += "### Top Issues\n";

            reportSummary.issues.slice(0, 5).forEach((issue: any) => {
              summary += `- **${issue.severity}**: ${issue.message}\n`;
            });

            if (reportSummary.issues.length > 5) {
              summary += `\n... and ${reportSummary.issues.length - 5} more issues.\n`;
            }
          }
        }

        return summary;
      } else if (reportExt === ".html") {
        // For HTML reports, we can't include the entire thing
        // so we'll just provide a link if possible
        return (
          "## PersRM Analysis Report\n\n" +
          "An HTML report was generated. Please check the artifacts for details.\n"
        );
      } else {
        // For other formats, return a generic message
        return (
          "## PersRM Analysis Report\n\n" +
          "A report was generated. Please check the artifacts for details.\n"
        );
      }
    } catch (error) {
      logger.error("Error generating report summary:", error);
      return (
        "## PersRM Analysis Report\n\n" +
        "Error generating report summary. Please check the artifacts for the full report.\n"
      );
    }
  }
}
