import { useState } from 'react';

export function useCSVImport() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(1);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parseResults, setParseResults] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setStep(1);
    setMapping({});
    setParseResults([]);
    setImportLoading(false);
    setError(null);
  };

  return {
    file, setFile,
    step, setStep,
    mapping, setMapping,
    parseResults, setParseResults,
    importLoading, setImportLoading,
    error, setError,
    reset
  };
}
