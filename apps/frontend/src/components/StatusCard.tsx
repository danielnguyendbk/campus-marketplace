import React from 'react';

interface StatusCardProps {
  title: string;
  status: 'success' | 'warning' | 'info' | 'error';
  description: string;
  details?: Record<string, string | number | boolean>;
}

export const StatusCard: React.FC<StatusCardProps> = ({ title, status, description, details }) => {
  return (
    <div className={`status-card status-${status}`}>
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        <span className={`badge badge-${status}`}>{status.toUpperCase()}</span>
      </div>
      <p className="card-description">{description}</p>
      {details && (
        <dl className="card-details">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="detail-row">
              <dt className="detail-key">{key}:</dt>
              <dd className="detail-value">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};
