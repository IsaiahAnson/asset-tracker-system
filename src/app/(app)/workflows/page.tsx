import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { workflowStages, workflows } from "@/lib/sample-data";
import { listOnboardingIntake } from "@/lib/onboarding";

// Always render fresh so a simulated HRIS pull (triggered from
// Integrations) shows its new onboarding row immediately on navigation.
export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const onboardingIntake = await listOnboardingIntake();
  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Workflow Operations</h1>
          <p className="usa-page-subtitle">
            Replace email routing with traceable onboarding, offboarding, transfer, and disposition workflows.
          </p>
        </div>
        <div className="page-actions">
          <Link className="usa-button usa-button--outline" href="/help/mulesoft-flow#notification-path">
            Configure notifications
          </Link>
          <Link className="usa-button usa-button--primary" href="/assets#asset-create">
            Start workflow
          </Link>
        </div>
      </div>

      <section className="usa-card" id="onboarding-intake">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Onboarding intake</span>
          <StatusTag tone="cyan">From HRIS</StatusTag>
        </div>
        <div className="usa-card__body">
          <p className="usa-hint mb-2">
            New-hire events open an onboarding workflow automatically. Use Sync now on the{" "}
            <Link href="/integrations">Integrations</Link> page to simulate the first HRIS
            pull; the new hire appears here, then flows into provisioning and issuing equipment.
          </p>
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Workflow</th>
                  <th scope="col">New hire</th>
                  <th scope="col">Personal email</th>
                  <th scope="col">Office</th>
                  <th scope="col">Start date</th>
                  <th scope="col">Stage</th>
                </tr>
              </thead>
              <tbody>
                {onboardingIntake.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No onboarding workflows yet. Trigger a sync from Integrations.</td>
                  </tr>
                ) : (
                  onboardingIntake.map((row) => (
                    <tr key={row.workflowNumber}>
                      <td className="font-mono">
                        <Link href={`/workflows/${row.id}`}>{row.workflowNumber}</Link>
                        {row.simulated ? (
                          <>
                            {" "}
                            <StatusTag tone="yellow">Simulated</StatusTag>
                          </>
                        ) : null}
                      </td>
                      <td>{row.hireName}</td>
                      <td>{row.personalEmail ?? "—"}</td>
                      <td>{row.office ?? "—"}</td>
                      <td className="font-mono">{row.startDate ?? "—"}</td>
                      <td>
                        <StatusTag tone="cyan">{row.stage}</StatusTag>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="workflow-board mt-3" aria-label="Workflow stages">
        {workflowStages.map((stage) => (
          <div className="workflow-lane" key={stage.name}>
            <div className="workflow-lane__header">
              <h2>{stage.name}</h2>
              <span className="workflow-lane__count">{stage.count}</span>
            </div>
            <p>{stage.summary}</p>
          </div>
        ))}
      </section>

      <section className="usa-card mt-3" id="workflow-queue">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Workflow queue</span>
          <StatusTag tone="cyan">MuleSoft boundary planned</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Workflow</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Person</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Due</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr key={workflow.id}>
                    <td className="font-mono">{workflow.id}</td>
                    <td>{workflow.title}</td>
                    <td>{workflow.owner}</td>
                    <td>{workflow.person}</td>
                    <td>
                      <StatusTag tone={workflow.status === "At risk" ? "yellow" : "cyan"}>
                        {workflow.stage}
                      </StatusTag>
                    </td>
                    <td>{workflow.due}</td>
                    <td>
                      <Link className="usa-button usa-button--outline usa-button--sm" href="/approvals">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}
