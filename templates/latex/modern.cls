%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Modern two-column resume class (ATS Beater house template)
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\ProvidesClass{modern}[2024/01/01 v1.0 Modern two-column resume class]

\LoadClass[10pt,letterpaper]{article}

\usepackage[parfill]{parskip}
\setlength{\parskip}{0.35em}

\usepackage{array}
\usepackage{ifthen}
\RequirePackage{needspace}

\usepackage{hyperref}
\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=blue,
    urlcolor=blue,
}

\pagestyle{empty}

% Sidebar section (left column)
\newenvironment{mSidebarSection}[1]{%
  \vspace{0.4em}%
  {\color{teal}\bfseries\small #1}\\[-0.2em]%
  \hrule height 0.6pt%
  \vspace{0.25em}%
  \begin{list}{}{%
    \setlength{\leftmargin}{0em}%
    \setlength{\parsep}{0.15em}%
  }%
  \item[]%
}{%
  \end{list}%
  \vspace{0.3em}%
}

% Main section (right column)
\newenvironment{mMainSection}[1]{%
  \needspace{4\baselineskip}%
  \vspace{0.2em}%
  {\bfseries\large #1}\\[-0.1em]%
  \hrule height 0.8pt%
  \vspace{0.3em}%
  \begin{list}{}{%
    \setlength{\leftmargin}{0em}%
  }%
  \item[]%
}{%
  \end{list}%
  \vspace{0.4em}%
}

\newenvironment{mSubsection}[4]{%
  \needspace{3\baselineskip}%
  {\bfseries #1} \hfill {\small #2}\\[-0.1em]%
  \ifthenelse{\equal{#3}{}}{}{%
    {\em\small #3} \hfill {\em\small #4}\\[-0.1em]%
  }%
  \begin{list}{$\bullet$}{%
    \leftmargin=0.8em%
    \itemsep -0.25em%
    \parsep 0em%
  }%
}{%
  \end{list}%
  \vspace{0.25em}%
}

\def\namesize{\LARGE}
