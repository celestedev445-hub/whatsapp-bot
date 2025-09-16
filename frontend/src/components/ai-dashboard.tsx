'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bot, Brain, MessageSquare, Settings, BarChart3, TestTube } from 'lucide-react';

interface AIStats {
  totalMessages: number;
  todayMessages: number;
  messagesByType: { [key: string]: number };
  messagesByAction: { [key: string]: number };
  avgConfidence: number;
  processed: number;
  notProcessed: number;
}

interface AIAnalysis {
  id: number;
  message_content: string;
  analysis_type: string;
  confidence: number;
  action: string;
  extracted_info: any;
  employee_name: string;
  created_at: string;
}

interface AISettings {
  [key: string]: {
    value: string;
    description: string;
  };
}

export default function AIDashboard() {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [settings, setSettings] = useState<AISettings>({});
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, analysesRes, settingsRes] = await Promise.all([
        fetch('/api/ai/stats'),
        fetch('/api/ai/analyses?limit=10'),
        fetch('/api/ai/settings')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      if (analysesRes.ok) {
        const analysesData = await analysesRes.json();
        setAnalyses(analysesData.data.analyses);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData.data);
      }

    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const testMessageAnalysis = async () => {
    if (!testMessage.trim()) return;

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage })
      });

      if (response.ok) {
        const result = await response.json();
        setTestResult(result.data);
      }
    } catch (err) {
      console.error('Erreur lors du test:', err);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      const response = await fetch('/api/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [key]: { value } } })
      });

      if (response.ok) {
        setSettings(prev => ({
          ...prev,
          [key]: { ...prev[key], value }
        }));
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
    }
  };

  const resetToDefaults = async () => {
    try {
      const response = await fetch('/api/ai/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        fetchData(); // Recharger les données
      }
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTypeDisplayName = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'attendance': 'Présence',
      'permission': 'Permission',
      'greeting': 'Salutation',
      'question': 'Question',
      'mention': 'Mention',
      'free_chat': 'Conversation libre',
      'other': 'Autre'
    };
    return typeMap[type] || type;
  };

  const getActionDisplayName = (action: string) => {
    const actionMap: { [key: string]: string } = {
      'arrival': 'Arrivée',
      'departure': 'Départ',
      'lunch_break': 'Pause déjeuner',
      'permission_request': 'Demande de permission',
      'free_chat': 'Conversation libre',
      'none': 'Aucune'
    };
    return actionMap[action] || action;
  };

  const getSettingDisplayName = (key: string) => {
    const settingMap: { [key: string]: string } = {
      'ai_enabled': 'Activer l\'IA',
      'confidence_threshold': 'Seuil de confiance',
      'max_response_length': 'Longueur max des réponses',
      'learning_enabled': 'Apprentissage automatique',
      'spam_detection_enabled': 'Détection de spam',
      'auto_response_enabled': 'Réponses automatiques',
      'context_memory_days': 'Mémoire contextuelle (jours)',
      'max_conversation_turns': 'Tours de conversation max',
      'sentiment_analysis_enabled': 'Analyse de sentiment',
      'topic_extraction_enabled': 'Extraction de sujets'
    };
    return settingMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSettingDescription = (key: string, originalDescription: string) => {
    const descriptionMap: { [key: string]: string } = {
      'ai_enabled': 'Active ou désactive l\'agent IA pour traiter les messages',
      'confidence_threshold': 'Niveau de confiance minimum pour traiter un message (0.0 - 1.0)',
      'max_response_length': 'Longueur maximale des réponses générées par l\'IA',
      'learning_enabled': 'Permet à l\'IA d\'apprendre et d\'améliorer ses réponses',
      'spam_detection_enabled': 'Active la détection automatique des messages indésirables',
      'auto_response_enabled': 'Active les réponses automatiques pour certains types de messages',
      'context_memory_days': 'Nombre de jours pendant lesquels l\'IA garde le contexte des conversations',
      'max_conversation_turns': 'Nombre maximum de tours de conversation à mémoriser',
      'sentiment_analysis_enabled': 'Active l\'analyse du sentiment des messages',
      'topic_extraction_enabled': 'Active l\'extraction automatique des sujets des conversations'
    };
    return descriptionMap[key] || originalDescription;
  };

  const getInputType = (key: string) => {
    if (key.includes('threshold') || key.includes('length') || key.includes('days') || key.includes('turns')) {
      return 'number';
    }
    return 'text';
  };

  const getMinValue = (key: string) => {
    if (key.includes('threshold')) return 0;
    if (key.includes('length')) return 10;
    if (key.includes('days')) return 1;
    if (key.includes('turns')) return 1;
    return undefined;
  };

  const getMaxValue = (key: string) => {
    if (key.includes('threshold')) return 1;
    if (key.includes('length')) return 1000;
    if (key.includes('days')) return 365;
    if (key.includes('turns')) return 50;
    return undefined;
  };

  const getStepValue = (key: string) => {
    if (key.includes('threshold')) return 0.1;
    return 1;
  };

  const getValueRange = (key: string) => {
    if (key.includes('threshold')) return '0.0 - 1.0';
    if (key.includes('length')) return '10 - 1000 caractères';
    if (key.includes('days')) return '1 - 365 jours';
    if (key.includes('turns')) return '1 - 50 tours';
    return '';
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'arrival': return 'bg-green-100 text-green-800';
      case 'departure': return 'bg-blue-100 text-blue-800';
      case 'lunch_break': return 'bg-orange-100 text-orange-800';
      case 'create_permission': return 'bg-purple-100 text-purple-800';
      case 'provide_help': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8 text-blue-600" />
            Agent IA
          </h1>
          <p className="text-gray-600">Gestion intelligente des conversations WhatsApp</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          Actualiser
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="analyses">Analyses</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Messages analysés</CardTitle>
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalMessages || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.todayMessages || 0} aujourd'hui
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Messages traités</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.processed || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalMessages > 0 ? ((stats.processed / stats.totalMessages) * 100).toFixed(1) : 0}% du total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Actions exécutées</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Object.values(stats.messagesByAction || {}).reduce((a: number, b: number) => a + b, 0)}</div>
                    <p className="text-xs text-muted-foreground">
                      Actions effectuées
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Confiance moyenne</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {((stats.avgConfidence || 0) * 100).toFixed(1)}%
                    </div>
                    <Progress 
                      value={(stats.avgConfidence || 0) * 100} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Répartition par type d'analyse</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.messagesByType || {}).map(([type, count]: [string, number], index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium capitalize">{getTypeDisplayName(type)}</p>
                          <p className="text-sm text-gray-600">
                            {count} analyses
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">
                            {count}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="analyses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyses récentes</CardTitle>
              <CardDescription>
                Dernières analyses effectuées par l'agent IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Confiance</TableHead>
                    <TableHead>Employé</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyses.map((analysis) => (
                    <TableRow key={analysis.id}>
                      <TableCell className="max-w-xs truncate">
                        {analysis.message_content}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTypeDisplayName(analysis.analysis_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadgeColor(analysis.action)}>
                          {getActionDisplayName(analysis.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getConfidenceColor(analysis.confidence)}`} />
                          {(analysis.confidence * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>{analysis.employee_name || 'Inconnu'}</TableCell>
                      <TableCell>
                        {new Date(analysis.created_at).toLocaleString('fr-FR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Paramètres de l'agent IA</CardTitle>
                  <CardDescription>
                    Configuration des paramètres de l'intelligence artificielle
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres aux valeurs par défaut ?')) {
                      resetToDefaults();
                    }
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Statut global */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${settings.ai_enabled?.value === 'true' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-medium">
                    Agent IA {settings.ai_enabled?.value === 'true' ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {settings.ai_enabled?.value === 'true' 
                    ? 'L\'agent IA traite actuellement les messages avec un seuil de confiance de ' + (settings.confidence_threshold?.value || '0.5')
                    : 'L\'agent IA est désactivé. Activez-le pour commencer le traitement des messages.'
                  }
                </p>
              </div>

              {/* Paramètres */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Configuration</h3>
                {Object.entries(settings).map(([key, setting]) => (
                <div key={key} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50">
                  <div className="space-y-1 flex-1">
                    <Label className="text-sm font-medium">{getSettingDisplayName(key)}</Label>
                    <p className="text-sm text-gray-600">{getSettingDescription(key, setting.description)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.includes('enabled') ? (
                      <Switch
                        checked={setting.value === 'true'}
                        onCheckedChange={(checked) => 
                          updateSetting(key, checked.toString())
                        }
                      />
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Input
                          value={setting.value}
                          onChange={(e) => updateSetting(key, e.target.value)}
                          className="w-32"
                          type={getInputType(key)}
                          min={getMinValue(key)}
                          max={getMaxValue(key)}
                          step={getStepValue(key)}
                        />
                        {getInputType(key) === 'number' && (
                          <span className="text-xs text-gray-500">
                            {getValueRange(key)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                ))}
              </div>

              {/* Paramètres avancés */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Paramètres avancés</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-gray-50/30">
                    <h4 className="font-medium text-sm mb-2">Performance</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      Ajustez les paramètres de performance de l'IA
                    </p>
                    <div className="space-y-2">
                      {Object.entries(settings).filter(([key]) => 
                        key.includes('threshold') || key.includes('length') || key.includes('turns')
                      ).map(([key, setting]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm">{getSettingDisplayName(key)}</span>
                          <Input
                            value={setting.value}
                            onChange={(e) => updateSetting(key, e.target.value)}
                            className="w-20 h-8"
                            type={getInputType(key)}
                            min={getMinValue(key)}
                            max={getMaxValue(key)}
                            step={getStepValue(key)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-gray-50/30">
                    <h4 className="font-medium text-sm mb-2">Fonctionnalités</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      Activez ou désactivez les fonctionnalités de l'IA
                    </p>
                    <div className="space-y-2">
                      {Object.entries(settings).filter(([key]) => 
                        key.includes('enabled') && key !== 'ai_enabled'
                      ).map(([key, setting]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm">{getSettingDisplayName(key)}</span>
                          <Switch
                            checked={setting.value === 'true'}
                            onCheckedChange={(checked) => 
                              updateSetting(key, checked.toString())
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test de l'agent IA</CardTitle>
              <CardDescription>
                Testez l'analyse de messages en temps réel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Tapez un message à analyser..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && testMessageAnalysis()}
                />
                <Button onClick={testMessageAnalysis} disabled={!testMessage.trim()}>
                  <TestTube className="h-4 w-4 mr-2" />
                  Analyser
                </Button>
              </div>

              {testResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Résultat de l'analyse</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type d'analyse</Label>
                        <Badge variant="outline" className="mt-1">
                          {getTypeDisplayName(testResult.analysis.type)}
                        </Badge>
                      </div>
                      <div>
                        <Label>Confiance</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={testResult.analysis.confidence * 100} className="flex-1" />
                          <span className="text-sm">{(testResult.analysis.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Action recommandée</Label>
                      <Badge className={getActionBadgeColor(testResult.analysis.action)}>
                        {getActionDisplayName(testResult.analysis.action)}
                      </Badge>
                    </div>

                    {testResult.response && (
                      <div>
                        <Label>Réponse générée</Label>
                        <p className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">
                          {testResult.response}
                        </p>
                      </div>
                    )}

                    {testResult.analysis.extractedInfo && Object.keys(testResult.analysis.extractedInfo).length > 0 && (
                      <div>
                        <Label>Informations extraites</Label>
                        <pre className="mt-1 p-3 bg-gray-50 rounded-lg text-xs overflow-auto">
                          {JSON.stringify(testResult.analysis.extractedInfo, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
